import type { Route } from "./+types/api.items.$id.tags";
import { getSessionUser } from "../lib/auth.server";
import { getTagsForEntity, setTagsForEntity } from "../lib/tags.server";

async function verifyItemOwnership(
	db: D1Database,
	itemId: string,
	ownerUserId: string,
): Promise<boolean> {
	const row = await db
		.prepare("SELECT 1 FROM items WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL")
		.bind(itemId, ownerUserId)
		.first();
	return !!row;
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const owned = await verifyItemOwnership(
		context.cloudflare.env.DB,
		params.id,
		user.id,
	);
	if (!owned) {
		return Response.json({ error: "Item not found" }, { status: 404 });
	}

	const tags = await getTagsForEntity(context.cloudflare.env.DB, "item", params.id);
	return Response.json({ tags });
}

export async function action({ params, request, context }: Route.ActionArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const owned = await verifyItemOwnership(
		context.cloudflare.env.DB,
		params.id,
		user.id,
	);
	if (!owned) {
		return Response.json({ error: "Item not found" }, { status: 404 });
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
		"item",
		params.id,
		tagNames,
	);
	return Response.json({ tags });
}
