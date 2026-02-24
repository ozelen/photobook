import type { Route } from "./+types/api.items.$id";
import { getSessionUser } from "../lib/auth.server";
import { updateItem } from "../lib/items.server";

async function verifyItemOwnership(
	db: D1Database,
	itemId: string,
	ownerUserId: string,
): Promise<boolean> {
	const row = await db
		.prepare("SELECT 1 FROM items WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL")
		.bind(itemId, ownerUserId)
		.first();
	return !!row;
}

export async function action({ params, request, context }: Route.ActionArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const owned = await verifyItemOwnership(
		context.cloudflare.env.DB,
		params.id,
		user.id,
	);
	if (!owned) {
		return Response.json({ error: "Item not found" }, { status: 404 });
	}

	if (request.method !== "PATCH" && request.method !== "PUT") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	let body: {
		title?: string | null;
		description?: string | null;
		cropMeta?: Record<string, { x: number; y: number }> | null;
	};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const ok = await updateItem(context.cloudflare.env.DB, params.id, user.id, {
		title: body.title,
		description: body.description,
		cropMeta: body.cropMeta,
	});
	if (!ok) {
		return Response.json({ error: "Failed to update item" }, { status: 500 });
	}
	return Response.json({ ok: true });
}
