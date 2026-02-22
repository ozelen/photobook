import type { Route } from "./+types/api.public.items.$id.image";
import { isItemInPublicAlbum } from "../lib/items.server";
import { fetchItemImage } from "../lib/fetch-item-image.server";

export async function loader({ params, context }: Route.LoaderArgs) {
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

	const imageId = (item as { image_id: string }).image_id;
	const env = context.cloudflare.env as {
		WEBDAV_BASE_URL?: string;
		WEBDAV_USERNAME?: string;
		WEBDAV_PASSWORD?: string;
		PHOTOPRISM_BASE_URL?: string;
	};

	return fetchItemImage(imageId, env);
}
