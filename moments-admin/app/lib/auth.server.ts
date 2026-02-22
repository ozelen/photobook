import bcrypt from "bcryptjs";

const SESSION_COOKIE = "moments_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const DEFAULT_SECRET = "dev-secret-change-in-production";

export interface SessionUser {
	id: string;
	email: string | null;
	firstName: string | null;
	role: string;
}

export async function verifyPassword(
	plainPassword: string,
	hash: string,
): Promise<boolean> {
	return bcrypt.compare(plainPassword, hash);
}

export async function getUserByEmail(
	db: D1Database,
	emailOrUsername: string,
): Promise<{ id: string; email: string | null; first_name: string | null; role: string; password_hash: string } | null> {
	const email = emailOrUsername.includes("@")
		? emailOrUsername
		: `${emailOrUsername}@example.com`;
	const row = await db
		.prepare(
			"SELECT id, email, first_name, role, password_hash FROM users WHERE email = ?",
		)
		.bind(email)
		.first();
	return row as typeof row & { password_hash: string } | null;
}

function encodeSession(userId: string): string {
	const expiry = Date.now() + SESSION_MAX_AGE * 1000;
	const payload = `${userId}:${expiry}`;
	return btoa(payload);
}

async function signSession(payload: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret.padEnd(32, "0").slice(0, 32)),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(payload),
	);
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifySession(signedPayload: string, secret: string): Promise<string | null> {
	const [payload, sigB64] = signedPayload.split(".");
	if (!payload || !sigB64) return null;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret.padEnd(32, "0").slice(0, 32)),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
	const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
	const valid = await crypto.subtle.verify(
		"HMAC",
		key,
		sig,
		encoder.encode(payload),
	);
	if (!valid) return null;
	const [userId, expiryStr] = atob(payload).split(":");
	const expiry = parseInt(expiryStr ?? "0", 10);
	if (Date.now() > expiry) return null;
	return userId;
}

export async function createSessionCookie(
	userId: string,
	secret: string = DEFAULT_SECRET,
): Promise<string> {
	const payload = encodeSession(userId);
	const sig = await signSession(payload, secret);
	const value = `${payload}.${sig}`;
	return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

export async function getSessionUserId(
	request: Request,
	secret: string = DEFAULT_SECRET,
): Promise<string | null> {
	const cookie = request.headers.get("Cookie");
	const match = cookie?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
	if (!match) return null;
	return verifySession(match[1], secret);
}

export async function getSessionUser(
	request: Request,
	db: D1Database,
	secret: string = DEFAULT_SECRET,
): Promise<SessionUser | null> {
	const userId = await getSessionUserId(request, secret);
	if (!userId) return null;
	const row = await db
		.prepare(
			"SELECT id, email, first_name, role FROM users WHERE id = ?",
		)
		.bind(userId)
		.first();
	if (!row) return null;
	return {
		id: (row as { id: string }).id,
		email: (row as { email: string | null }).email,
		firstName: (row as { first_name: string | null }).first_name,
		role: (row as { role: string }).role,
	};
}
