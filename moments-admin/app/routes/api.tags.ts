import type { Route } from "./+types/api.tags";
import { getSessionUser } from "../lib/auth.server";
import { listTags } from "../lib/tags.server";

export async function loader({ request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const tags = await listTags(context.cloudflare.env.DB);
	return Response.json({ tags });
}
