import type { Route } from "./+types/api.photoprism.photos.all";
import { getSessionUser } from "../lib/auth.server";
import { fetchAllPhotoPrismPhotos } from "../lib/photoprism.server";

export async function loader({ request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const env = context.cloudflare.env as {
		PHOTOPRISM_BASE_URL?: string;
		WEBDAV_USERNAME?: string;
		WEBDAV_PASSWORD?: string;
	};
	const { PHOTOPRISM_BASE_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD } = env;
	if (!PHOTOPRISM_BASE_URL || !WEBDAV_USERNAME || !WEBDAV_PASSWORD) {
		return Response.json({ error: "PhotoPrism not configured" }, { status: 500 });
	}

	const url = new URL(request.url);
	const albumUid = url.searchParams.get("album") ?? undefined;

	try {
		const photos = await fetchAllPhotoPrismPhotos(
			PHOTOPRISM_BASE_URL,
			WEBDAV_USERNAME,
			WEBDAV_PASSWORD,
			albumUid,
		);
		return Response.json({ photos });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to fetch photos";
		return Response.json({ error: message }, { status: 502 });
	}
}
