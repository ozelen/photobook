import type { Route } from "./+types/api.items.$id.image";
import { getSessionUser } from "../lib/auth.server";
import { fetchFromWebDAV } from "../lib/webdav.server";
import {
	isPhotoPrismRef,
	fromPhotoPrismRef,
	getPhotoPrismThumbnailUrl,
	fetchPhotoPrismPhotos,
} from "../lib/photoprism.server";

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

	if (isPhotoPrismRef(imageId)) {
		const hash = fromPhotoPrismRef(imageId);
		if (!hash) return new Response("Not found", { status: 404 });
		const env = context.cloudflare.env as {
			PHOTOPRISM_BASE_URL?: string;
			WEBDAV_USERNAME?: string;
			WEBDAV_PASSWORD?: string;
		};
		const { PHOTOPRISM_BASE_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD } = env;
		if (!PHOTOPRISM_BASE_URL || !WEBDAV_USERNAME || !WEBDAV_PASSWORD) {
			return new Response("PhotoPrism not configured", { status: 500 });
		}
		try {
			const { previewToken } = await fetchPhotoPrismPhotos(
				PHOTOPRISM_BASE_URL,
				WEBDAV_USERNAME,
				WEBDAV_PASSWORD,
				{ count: 1 },
			);
			const thumbUrl = getPhotoPrismThumbnailUrl(
				PHOTOPRISM_BASE_URL,
				hash,
				previewToken,
				"tile_500",
			);
			let thumbRes = await fetch(thumbUrl, { headers: { Accept: "image/*" } });
			if (!thumbRes.ok) {
				const sessionRes = await fetch(
					`${PHOTOPRISM_BASE_URL.replace(/\/$/, "")}/api/v1/session`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							username: WEBDAV_USERNAME,
							password: WEBDAV_PASSWORD,
						}),
					},
				);
				if (!sessionRes.ok) return new Response("Failed to fetch image", { status: 502 });
				const sessionJson = (await sessionRes.json()) as { id?: string };
				const sessionId = sessionJson.id;
				if (!sessionId) return new Response("Failed to fetch image", { status: 502 });
				thumbRes = await fetch(thumbUrl, {
					headers: {
						Accept: "image/*",
						"X-Session-ID": sessionId,
					},
				});
				if (!thumbRes.ok) return new Response("Failed to fetch image", { status: 502 });
			}
			const contentType = thumbRes.headers.get("Content-Type") || "image/jpeg";
			return new Response(thumbRes.body, {
				headers: {
					"Content-Type": contentType,
					"Cache-Control": "private, max-age=3600",
				},
			});
		} catch {
			return new Response("Failed to fetch image", { status: 502 });
		}
	}

	const env = context.cloudflare.env as {
		WEBDAV_BASE_URL?: string;
		WEBDAV_USERNAME?: string;
		WEBDAV_PASSWORD?: string;
	};
	const { WEBDAV_BASE_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD } = env;
	if (!WEBDAV_BASE_URL || !WEBDAV_USERNAME || !WEBDAV_PASSWORD) {
		return new Response("WebDAV not configured", { status: 500 });
	}

	try {
		const res = await fetchFromWebDAV(
			WEBDAV_BASE_URL,
			WEBDAV_USERNAME,
			WEBDAV_PASSWORD,
			imageId,
		);
		const contentType = res.headers.get("Content-Type") || "image/jpeg";
		return new Response(res.body, {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "private, max-age=3600",
			},
		});
	} catch {
		return new Response("Failed to fetch image", { status: 502 });
	}
}
