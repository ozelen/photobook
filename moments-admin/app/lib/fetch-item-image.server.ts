import { fetchFromWebDAV } from "./webdav.server";
import {
	isPhotoPrismRef,
	fromPhotoPrismRef,
	getPhotoPrismThumbnailUrl,
	fetchPhotoPrismPhotos,
} from "./photoprism.server";
import { isCfImageRef, fromCfImageRef } from "./cf-images.server";

export interface FetchImageEnv {
	WEBDAV_BASE_URL?: string;
	WEBDAV_USERNAME?: string;
	WEBDAV_PASSWORD?: string;
	PHOTOPRISM_BASE_URL?: string;
	CF_IMAGES_DELIVERY_HASH?: string;
}

export async function fetchItemImage(
	imageId: string,
	env: FetchImageEnv,
): Promise<Response> {
	if (isCfImageRef(imageId)) {
		const cfId = fromCfImageRef(imageId);
		const hash = env.CF_IMAGES_DELIVERY_HASH;
		if (!cfId || !hash) return new Response("Not found", { status: 404 });
		const url = `https://imagedelivery.net/${hash}/${cfId}/public`;
		const res = await fetch(url, { headers: { Accept: "image/*" } });
		if (!res.ok) return new Response("Failed to fetch image", { status: 502 });
		const contentType = res.headers.get("Content-Type") || "image/jpeg";
		return new Response(res.body, {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=86400",
			},
		});
	}

	if (isPhotoPrismRef(imageId)) {
		const hash = fromPhotoPrismRef(imageId);
		if (!hash) return new Response("Not found", { status: 404 });
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
			// Use fit_1920 for raw image so hero (1920x1080) is downscaled, not upscaled
			const thumbUrl = getPhotoPrismThumbnailUrl(
				PHOTOPRISM_BASE_URL,
				hash,
				previewToken,
				"fit_1920",
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
					"Cache-Control": "public, max-age=86400",
				},
			});
		} catch {
			return new Response("Failed to fetch image", { status: 502 });
		}
	}

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
				"Cache-Control": "public, max-age=86400",
			},
		});
	} catch {
		return new Response("Failed to fetch image", { status: 502 });
	}
}
