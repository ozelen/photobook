import { Form, redirect } from "react-router";
import type { Route } from "./+types/login";
import {
	getSessionUser,
	getUserByEmail,
	verifyPassword,
	createSessionCookie,
} from "../lib/auth.server";

export function meta() {
	return [{ title: "Login — Moments Admin" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (user) return redirect("/");
	return null;
}

export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const email = String(formData.get("email") ?? "").trim();
	const password = String(formData.get("password") ?? "");

	if (!email || !password) {
		return { error: "Email and password are required" };
	}

	const user = await getUserByEmail(context.cloudflare.env.DB, email);
	if (!user) {
		return { error: "Invalid email or password" };
	}

	const valid = await verifyPassword(password, user.password_hash);
	if (!valid) {
		return { error: "Invalid email or password" };
	}

	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET ?? undefined;
	const cookie = await createSessionCookie(user.id, secret);
	return redirect("/", {
		headers: { "Set-Cookie": cookie },
	});
}

export default function Login({ actionData }: Route.ComponentProps) {
	return (
		<main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
			<div className="w-full max-w-sm">
				<div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
					<h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
						Moments Admin
					</h1>
					<p className="text-gray-600 dark:text-gray-400 mb-6">
						Sign in to continue
					</p>
					<Form method="post" className="space-y-4">
						<div>
							<label
								htmlFor="email"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Email
							</label>
							<input
								id="email"
								name="email"
								type="text"
								autoComplete="username"
								placeholder="email@example.com"
								className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								required
							/>
						</div>
						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								required
							/>
						</div>
						{actionData?.error && (
							<p className="text-sm text-red-600 dark:text-red-400">
								{actionData.error}
							</p>
						)}
						<button
							type="submit"
							className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
						>
							Sign in
						</button>
					</Form>
				</div>
			</div>
		</main>
	);
}
