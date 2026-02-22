import type { Route } from "./+types/api.photoprism.thumb.$hash";
import { getSessionUser } from "../lib/auth.server";
import {
	getPhotoPrismThumbnailUrl,
	fetchPhotoPrismPhotos,
} from "../lib/photoprism.server";

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const env = context.cloudflare.env as {
		PHOTOPRISM_BASE_URL?: string;
		WEBDAV_USERNAME?: string;
		WEBDAV_PASSWORD?: string;
	};
	const { PHOTOPRISM_BASE_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD } = env;
	if (!PHOTOPRISM_BASE_URL || !WEBDAV_USERNAME || !WEBDAV_PASSWORD) {
		return new Response("PhotoPrism not configured", { status: 500 });
	}

	const hash = params.hash;
	if (!hash) return new Response("Not found", { status: 404 });

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
			if (!sessionRes.ok) return new Response("Failed to fetch", { status: 502 });
			const sessionJson = (await sessionRes.json()) as { id?: string };
			const sessionId = sessionJson.id;
			if (!sessionId) return new Response("Failed to fetch", { status: 502 });
			thumbRes = await fetch(thumbUrl, {
				headers: { Accept: "image/*", "X-Session-ID": sessionId },
			});
			if (!thumbRes.ok) return new Response("Failed to fetch", { status: 502 });
		}
		const contentType = thumbRes.headers.get("Content-Type") || "image/jpeg";
		return new Response(thumbRes.body, {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "private, max-age=3600",
			},
		});
	} catch {
		return new Response("Failed to fetch", { status: 502 });
	}
}
