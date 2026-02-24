import { ulid } from "ulid";

const ALBUM_KINDS = ["portfolio", "client_delivery"] as const;
export type AlbumKind = (typeof ALBUM_KINDS)[number];

export interface Album {
	id: string;
	ownerUserId: string;
	kind: string;
	isPublic: number;
	orderId: string | null;
	slug: string;
	name: string;
	description: string | null;
	model: string | null;
	lat: number | null;
	lng: number | null;
	coverItemId: string | null;
	publicVersion: number;
	createdAt: string;
	updatedAt: string | null;
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function toAlbum(row: Record<string, unknown>): Album {
	return {
		id: row.id as string,
		ownerUserId: row.owner_user_id as string,
		kind: row.kind as string,
		isPublic: (row.is_public as number) ?? 0,
		orderId: (row.order_id as string) || null,
		slug: row.slug as string,
		name: row.name as string,
		description: (row.description as string) || null,
		model: (row.model as string) || null,
		lat: (row.lat as number) ?? null,
		lng: (row.lng as number) ?? null,
		coverItemId: (row.cover_item_id as string) || null,
		publicVersion: (row.public_version as number) ?? 0,
		createdAt: row.created_at as string,
		updatedAt: (row.updated_at as string) || null,
	};
}

export async function listAlbums(
	db: D1Database,
	ownerUserId: string,
): Promise<Album[]> {
	const { results } = await db
		.prepare(
			"SELECT * FROM albums WHERE owner_user_id = ? ORDER BY created_at DESC",
		)
		.bind(ownerUserId)
		.all();
	return (results ?? []).map((r) => toAlbum(r as Record<string, unknown>));
}

export async function getAlbum(
	db: D1Database,
	id: string,
	ownerUserId: string,
): Promise<Album | null> {
	const row = await db
		.prepare(
			"SELECT * FROM albums WHERE id = ? AND owner_user_id = ?",
		)
		.bind(id, ownerUserId)
		.first();
	return row ? toAlbum(row as Record<string, unknown>) : null;
}

async function ensureUniqueSlug(
	db: D1Database,
	ownerUserId: string,
	slug: string,
	excludeId?: string,
): Promise<string> {
	let candidate = slug || "untitled";
	let suffix = 0;
	while (true) {
		const row = excludeId
			? await db
					.prepare(
						"SELECT 1 FROM albums WHERE owner_user_id = ? AND slug = ? AND id != ?",
					)
					.bind(ownerUserId, candidate, excludeId)
					.first()
			: await db
					.prepare("SELECT 1 FROM albums WHERE owner_user_id = ? AND slug = ?")
					.bind(ownerUserId, candidate)
					.first();
		if (!row) return candidate;
		suffix++;
		candidate = `${slug || "untitled"}-${suffix}`;
	}
}

function outboxStatement(
	db: D1Database,
	aggregateType: string,
	aggregateId: string,
	eventType: string,
	payload: string,
	version: number,
) {
	return db
		.prepare(
			`INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
		)
		.bind(ulid(), aggregateType, aggregateId, eventType, payload, version);
}

export async function createAlbum(
	db: D1Database,
	ownerUserId: string,
	input: {
		name: string;
		slug?: string;
		kind?: AlbumKind;
		description?: string;
		model?: string;
		isPublic?: boolean;
	},
): Promise<Album> {
	const kind = input.kind ?? "portfolio";
	const isPublic = input.isPublic ? 1 : 0;
	const baseSlug = input.slug ?? slugify(input.name);
	const slug = await ensureUniqueSlug(db, ownerUserId, baseSlug);
	const id = ulid();
	const now = new Date().toISOString();

	await db.batch([
		db
			.prepare(
				`INSERT INTO albums (id, owner_user_id, kind, is_public, slug, name, description, model, public_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
			)
			.bind(
				id,
				ownerUserId,
				kind,
				isPublic,
				slug,
				input.name,
				input.description ?? null,
				input.model ?? null,
				now,
				now,
			),
		db
			.prepare(
				`INSERT INTO album_members (user_id, album_id, role, created_at) VALUES (?, ?, 'owner', datetime('now'))`,
			)
			.bind(ownerUserId, id),
		outboxStatement(
			db,
			"album",
			id,
			"upsert",
			JSON.stringify({ id, slug, name: input.name, kind, isPublic }),
			0,
		),
	]);

	const album = await getAlbum(db, id, ownerUserId);
	if (!album) throw new Error("Failed to create album");
	return album;
}

export async function updateAlbum(
	db: D1Database,
	id: string,
	ownerUserId: string,
	input: {
		name?: string;
		slug?: string;
		kind?: AlbumKind;
		description?: string;
		model?: string;
		isPublic?: boolean;
		coverItemId?: string | null;
	},
): Promise<Album | null> {
	const existing = await getAlbum(db, id, ownerUserId);
	if (!existing) return null;

	const name = input.name ?? existing.name;
	const kind = input.kind ?? existing.kind;
	const isPublic = input.isPublic !== undefined ? (input.isPublic ? 1 : 0) : existing.isPublic;
	const baseSlug = input.slug ?? slugify(input.name ?? existing.name);
	const slug = await ensureUniqueSlug(db, ownerUserId, baseSlug, id);
	const coverItemId = input.coverItemId !== undefined ? input.coverItemId : existing.coverItemId;
	const newVersion = existing.publicVersion + 1;
	const now = new Date().toISOString();

	await db.batch([
		db
			.prepare(
				`UPDATE albums SET name = ?, slug = ?, kind = ?, description = ?, model = ?, is_public = ?, cover_item_id = ?, public_version = ?, updated_at = ?
         WHERE id = ? AND owner_user_id = ?`,
			)
			.bind(
				name,
				slug,
				kind,
				input.description ?? existing.description,
				input.model ?? existing.model,
				isPublic,
				coverItemId ?? null,
				newVersion,
				now,
				id,
				ownerUserId,
			),
		outboxStatement(
			db,
			"album",
			id,
			"upsert",
			JSON.stringify({ id, slug, name, kind, isPublic, coverItemId }),
			newVersion,
		),
	]);

	return getAlbum(db, id, ownerUserId);
}

export async function deleteAlbum(
	db: D1Database,
	id: string,
	ownerUserId: string,
): Promise<boolean> {
	const existing = await getAlbum(db, id, ownerUserId);
	if (!existing) return false;

	await db.batch([
		db.prepare("DELETE FROM album_items WHERE album_id = ?").bind(id),
		db.prepare("DELETE FROM album_members WHERE album_id = ?").bind(id),
		db
			.prepare("DELETE FROM tag_refs WHERE entity_type = 'album' AND entity_id = ?")
			.bind(id),
		outboxStatement(db, "album", id, "delete", "{}", existing.publicVersion + 1),
		db.prepare("DELETE FROM albums WHERE id = ? AND owner_user_id = ?").bind(id, ownerUserId),
	]);

	return true;
}

export function isValidKind(k: string): k is AlbumKind {
	return ALBUM_KINDS.includes(k as AlbumKind);
}
