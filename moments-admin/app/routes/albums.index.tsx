import { Form, Link } from "react-router";
import type { Route } from "./+types/albums.index";
import { getSessionUser } from "../lib/auth.server";
import { listAlbums } from "../lib/albums.server";

export function meta() {
	return [{ title: "Albums — Moments Admin" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return { albums: [] };
	const albums = await listAlbums(context.cloudflare.env.DB, user.id);
	return { albums };
}

export default function AlbumsIndex({ loaderData }: Route.ComponentProps) {
	const { albums } = loaderData;

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
					Albums
				</h1>
				<Link
					to="/albums/new"
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
				>
					New album
				</Link>
			</div>
			{albums.length === 0 ? (
				<div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
					<p className="text-gray-600 dark:text-gray-400 mb-4">
						No albums yet.
					</p>
					<Link
						to="/albums/new"
						className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
					>
						Create your first album
					</Link>
				</div>
			) : (
				<ul className="space-y-3">
					{albums.map((album) => (
						<li
							key={album.id}
							className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
						>
							<div>
								<Link
									to={`/albums/${album.id}`}
									className="font-medium text-gray-900 dark:text-white hover:underline"
								>
									{album.name}
								</Link>
								<p className="text-sm text-gray-500 dark:text-gray-400">
									/{album.slug} · {album.kind}
									{album.isPublic ? " · Public" : ""}
								</p>
							</div>
							<div className="flex gap-2">
								<Link
									to={`/albums/${album.id}/edit`}
									className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
								>
									Edit
								</Link>
								<Form method="post" action={`/albums/${album.id}`}>
									<input type="hidden" name="_action" value="delete" />
									<button
										type="submit"
										className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
										onClick={(e) => {
											if (!confirm("Delete this album?")) e.preventDefault();
										}}
									>
										Delete
									</button>
								</Form>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
