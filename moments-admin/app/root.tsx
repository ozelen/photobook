import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	redirect,
	Scripts,
	ScrollRestoration,
	useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import { getSessionUser } from "./lib/auth.server";
import "./app.css";

export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	if (url.pathname === "/login" || url.pathname === "/logout") {
		return { user: null };
	}
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");
	return { user };
}

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	const data = useRouteLoaderData("root") as { user: { firstName: string | null } | null } | undefined;
	const user = data?.user;

	return (
		<>
			{user && (
				<nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="flex justify-between h-14 items-center">
							<div className="flex items-center gap-6">
								<a href="/" className="font-semibold text-gray-900 dark:text-white">
									Moments Admin
								</a>
								<a
									href="/albums"
									className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
								>
									Albums
								</a>
								<a
									href="/gallery"
									className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
								>
									Gallery
								</a>
							</div>
							<div className="flex items-center gap-4">
								<span className="text-sm text-gray-600 dark:text-gray-400">
									{user.firstName ?? user}
								</span>
								<a
									href="/logout"
									className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
								>
									Log out
								</a>
							</div>
						</div>
					</div>
				</nav>
			)}
			<main className={user ? "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" : ""}>
				<Outlet />
			</main>
		</>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404
				? "The requested page could not be found."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
