import type { Route } from "./+types/api.public.items.$id.image";
import { isItemInPublicAlbum } from "../lib/items.server";
import { fetchItemImage } from "../lib/fetch-item-image.server";
import { getCfImageUrl } from "../lib/images.server";

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const raw = url.searchParams.get("raw") === "1";
	const variant = url.searchParams.get("variant") as "thumb" | "hero" | null;

	const item = await context.cloudflare.env.DB.prepare(
		"SELECT image_id, meta FROM items WHERE id = ? AND deleted_at IS NULL",
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

	// When variant=thumb or variant=hero, redirect to cdn-cgi/image URL with focal point
	if (!raw && (variant === "thumb" || variant === "hero")) {
		const meta = (item as { meta: string | null }).meta;
		let gravity: { x: number; y: number } | undefined;
		if (meta) {
			try {
				const parsed = JSON.parse(meta) as { crop?: Record<string, { x: number; y: number }> };
				const crop = parsed?.crop?.[variant];
				if (crop && typeof crop.x === "number" && typeof crop.y === "number") {
					gravity = { x: crop.x, y: crop.y };
				}
			} catch {
				// ignore
			}
		}
		const origin = url.origin;
		const sourceUrl = `${origin}/api/public/items/${params.id}/image?raw=1`;
		const transformedUrl = getCfImageUrl(origin, sourceUrl, variant, gravity);
		return Response.redirect(transformedUrl, 302);
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
