import { useRouteLoaderData } from "react-router";
import type { Route } from "./+types/home";

export function meta() {
	return [
		{ title: "Moments Admin" },
		{ name: "description", content: "Photo platform admin" },
	];
}

export default function Home() {
	const data = useRouteLoaderData("root") as { user: { firstName: string | null; email: string | null } } | undefined;
	const user = data?.user;

	return (
		<div>
			<h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
				Welcome{user?.firstName ? `, ${user.firstName}` : ""}
			</h1>
			<p className="text-gray-600 dark:text-gray-400 mb-4">
				Moments admin dashboard. Manage albums, photos, and more.
			</p>
			<a
				href="/albums"
				className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
			>
				Manage albums
			</a>
		</div>
	);
}
