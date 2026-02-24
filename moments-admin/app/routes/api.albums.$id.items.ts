import type { Route } from "./+types/api.albums.$id.items";
import { getSessionUser } from "../lib/auth.server";
import { getAlbum } from "../lib/albums.server";
import { addItemToAlbum } from "../lib/items.server";
import { toPhotoPrismRef } from "../lib/photoprism.server";
import { enqueueCfImagesUpload } from "../lib/enqueue-cf-images.server";

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

	const album = await getAlbum(context.cloudflare.env.DB, params.id, user.id);
	if (!album) {
		return Response.json({ error: "Album not found" }, { status: 404 });
	}

	let body: { imageId?: string; photoprismHash?: string };
	try {
		body = (await request.json()) as { imageId?: string; photoprismHash?: string };
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	let imageId = body.imageId?.trim();
	if (!imageId && body.photoprismHash?.trim()) {
		imageId = toPhotoPrismRef(body.photoprismHash.trim());
	}
	if (!imageId) {
		return Response.json({ error: "imageId or photoprismHash is required" }, { status: 400 });
	}

	const result = await addItemToAlbum(
		context.cloudflare.env.DB,
		params.id,
		user.id,
		imageId,
	);
	if (!result) {
		return Response.json({ error: "Failed to add item" }, { status: 500 });
	}

	const env = context.cloudflare.env as Parameters<typeof enqueueCfImagesUpload>[0];
	context.cloudflare.ctx.waitUntil(
		enqueueCfImagesUpload(env, result.id, imageId),
	);

	return Response.json({ id: result.id });
}
