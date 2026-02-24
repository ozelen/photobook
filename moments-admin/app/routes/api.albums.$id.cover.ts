import type { Route } from "./+types/api.albums.$id.cover";
import { getSessionUser } from "../lib/auth.server";
import { updateAlbum } from "../lib/albums.server";

export async function loader() {
	return new Response(JSON.stringify({ error: "Method not allowed" }), {
		status: 405,
		headers: { "Content-Type": "application/json" },
	});
}

export async function action({ params, request, context }: Route.ActionArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (request.method !== "PATCH" && request.method !== "PUT") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	let body: { coverItemId?: string | null };
	try {
		body = (await request.json()) as { coverItemId?: string | null };
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const coverItemId = body.coverItemId ?? null;
	if (coverItemId) {
		const inAlbum = await context.cloudflare.env.DB.prepare(
			`SELECT 1 FROM album_items ai
       JOIN items i ON i.id = ai.item_id AND i.owner_user_id = ?
       WHERE ai.album_id = ? AND ai.item_id = ?`,
		)
			.bind(user.id, params.id, coverItemId)
			.first();
		if (!inAlbum) {
			return Response.json({ error: "Item not in this album" }, { status: 400 });
		}
	}

	const album = await updateAlbum(context.cloudflare.env.DB, params.id, user.id, {
		coverItemId,
	});
	if (!album) {
		return Response.json({ error: "Album not found" }, { status: 404 });
	}
	return Response.json({ coverItemId: album.coverItemId });
}
