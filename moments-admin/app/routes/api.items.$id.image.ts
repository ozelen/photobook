import type { Route } from "./+types/api.items.$id.image";
import { getSessionUser } from "../lib/auth.server";
import { fetchItemImage } from "../lib/fetch-item-image.server";

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const item = await context.cloudflare.env.DB.prepare(
		"SELECT image_id FROM items WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL",
	)
		.bind(params.id, user.id)
		.first();

	if (!item || !(item as { image_id: string | null }).image_id) {
		return new Response("Not found", { status: 404 });
	}

	const imageId = (item as { image_id: string }).image_id;
	const env = context.cloudflare.env as {
		WEBDAV_BASE_URL?: string;
		WEBDAV_USERNAME?: string;
		WEBDAV_PASSWORD?: string;
		PHOTOPRISM_BASE_URL?: string;
	};

	const res = await fetchItemImage(imageId, env);
	if (res.headers.get("Cache-Control") === "public, max-age=86400") {
		return new Response(res.body, {
			headers: {
				"Content-Type": res.headers.get("Content-Type") || "image/jpeg",
				"Cache-Control": "private, max-age=3600",
			},
		});
	}
	return res;
}
