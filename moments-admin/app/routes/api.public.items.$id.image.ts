import type { Route } from "./+types/api.public.items.$id.image";
import { isItemInPublicAlbum } from "../lib/items.server";
import { fetchItemImage } from "../lib/fetch-item-image.server";

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const item = await context.cloudflare.env.DB.prepare(
		"SELECT image_id FROM items WHERE id = ? AND deleted_at IS NULL",
	)
		.bind(params.id)
		.first();

	if (!item || !(item as { image_id: string | null }).image_id) {
		return new Response("Not found", { status: 404 });
	}

	const inPublic = await isItemInPublicAlbum(context.cloudflare.env.DB, params.id);
	if (!inPublic) {
		return new Response("Not found", { status: 404 });
	}

	const cached = await caches.default.match(request);
	if (cached) return cached;

	const imageId = (item as { image_id: string }).image_id;
	const env = context.cloudflare.env as {
		WEBDAV_BASE_URL?: string;
		WEBDAV_USERNAME?: string;
		WEBDAV_PASSWORD?: string;
		PHOTOPRISM_BASE_URL?: string;
	};

	const res = await fetchItemImage(imageId, env);
	const resToCache = res.clone();
	await caches.default.put(request, resToCache);
	return res;
}
