import { redirect } from "react-router";
import type { Route } from "./+types/logout";

const SESSION_COOKIE = "moments_session";

export async function loader({ request }: Route.LoaderArgs) {
	return redirect("/login", {
		headers: {
			"Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`,
		},
	});
}
