import type { Route } from "./+types/api.albums.$id.items.tags";
import { getSessionUser } from "../lib/auth.server";
import { getAlbum } from "../lib/albums.server";
import { addTagsToEntity } from "../lib/tags.server";

export async function action({ params, request, context }: Route.ActionArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const album = await getAlbum(context.cloudflare.env.DB, params.id, user.id);
	if (!album) {
		return Response.json({ error: "Album not found" }, { status: 404 });
	}

	if (request.method !== "PUT") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	let body: { itemIds?: string[]; tagNames?: string[] };
	try {
		body = (await request.json()) as { itemIds?: string[]; tagNames?: string[] };
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const itemIds = Array.isArray(body.itemIds)
		? body.itemIds.filter((id): id is string => typeof id === "string")
		: [];
	const tagNames = Array.isArray(body.tagNames)
		? body.tagNames.filter((n): n is string => typeof n === "string")
		: [];

	if (itemIds.length === 0 || tagNames.length === 0) {
		return Response.json({ error: "itemIds and tagNames arrays required" }, { status: 400 });
	}

	const db = context.cloudflare.env.DB;
	const verified: string[] = [];
	for (const itemId of itemIds) {
		const inAlbum = await db
			.prepare(
				`SELECT 1 FROM album_items ai
         JOIN items i ON i.id = ai.item_id AND i.owner_user_id = ? AND i.deleted_at IS NULL
         WHERE ai.album_id = ? AND ai.item_id = ?`,
			)
			.bind(user.id, params.id, itemId)
			.first();
		if (inAlbum) verified.push(itemId);
	}

	for (const itemId of verified) {
		await addTagsToEntity(db, "item", itemId, tagNames);
	}

	return Response.json({ updated: verified.length });
}
