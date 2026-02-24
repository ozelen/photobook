import type { Route } from "./+types/api.albums.$id.tags";
import { getSessionUser } from "../lib/auth.server";
import { getAlbum } from "../lib/albums.server";
import { getTagsForEntity, setTagsForEntity } from "../lib/tags.server";

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const album = await getAlbum(context.cloudflare.env.DB, params.id, user.id);
	if (!album) {
		return Response.json({ error: "Album not found" }, { status: 404 });
	}

	const tags = await getTagsForEntity(context.cloudflare.env.DB, "album", params.id);
	return Response.json({ tags });
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

	if (request.method !== "PUT") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	let body: { tagNames?: string[] };
	try {
		body = (await request.json()) as { tagNames?: string[] };
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const tagNames = Array.isArray(body.tagNames)
		? body.tagNames.filter((n): n is string => typeof n === "string")
		: [];
	const tags = await setTagsForEntity(
		context.cloudflare.env.DB,
		"album",
		params.id,
		tagNames,
	);
	return Response.json({ tags });
}
