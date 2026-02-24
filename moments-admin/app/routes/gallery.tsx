import { Link } from "react-router";
import type { Route } from "./+types/gallery";
import { getSessionUser } from "../lib/auth.server";
import { getPublicAlbums } from "../lib/public-albums.server";

export function meta() {
	return [{ title: "Gallery Preview — Moments Admin" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return { albums: [], portfolioUrl: null, adminOrigin: "" };

	const albums = await getPublicAlbums(context.cloudflare.env.DB);
	const portfolioUrl =
		(context.cloudflare.env as { PORTFOLIO_URL?: string }).PORTFOLIO_URL ??
		"https://moments.zelen.uk";
	const adminOrigin = new URL(request.url).origin;

	return { albums, portfolioUrl, adminOrigin };
}

function getItemImageUrl(origin: string, itemId: string): string {
	const base = origin.replace(/\/$/, "");
	return `${base}/api/public/items/${itemId}/image`;
}

export default function Gallery({ loaderData }: Route.ComponentProps) {
	const { albums, portfolioUrl, adminOrigin } = loaderData;

	const galleryItems = albums.flatMap((a) =>
		a.items.slice(0, 12).map((item) => ({
			...item,
			albumName: a.name,
			albumSlug: a.slug,
			thumbUrl: getItemImageUrl(adminOrigin, item.id),
		})),
	);

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
					Gallery Preview
				</h1>
				{portfolioUrl && (
					<a
						href={portfolioUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
					>
						View portfolio →
					</a>
				)}
			</div>
			<p className="text-gray-600 dark:text-gray-400 mb-6">
				This is what visitors see on the portfolio gallery. Albums marked as{" "}
				<strong>Public</strong> in Edit appear here. Toggle visibility in{" "}
				<Link to="/albums" className="text-blue-600 hover:underline">
					Albums
				</Link>
				.
			</p>

			{albums.length === 0 ? (
				<div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
					<p className="text-gray-600 dark:text-gray-400 mb-4">
						No public albums yet.
					</p>
					<p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
						Edit an album and check &quot;Public (visible on portfolio)&quot; to show it here.
					</p>
					<Link
						to="/albums"
						className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
					>
						Manage albums
					</Link>
				</div>
			) : (
				<>
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
						{galleryItems.map((item) => (
							<a
								key={item.id}
								href={portfolioUrl ? `${portfolioUrl}/gallery/${item.albumSlug}` : "#"}
								target="_blank"
								rel="noopener noreferrer"
								className="group block aspect-square overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700"
							>
								<img
									src={item.thumbUrl}
									alt={item.albumName}
									loading="lazy"
									className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
							</a>
						))}
					</div>

					<div>
						<h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
							Public albums ({albums.length})
						</h2>
						<ul className="space-y-2">
							{albums.map((album) => (
								<li key={album.id} className="flex items-center gap-2">
									<Link
										to={`/albums/${album.id}`}
										className="text-blue-600 hover:underline dark:text-blue-400"
									>
										{album.name}
									</Link>
									<span className="text-gray-500 dark:text-gray-400 text-sm">
										/{album.slug} · {album.items.length} photos
									</span>
									{portfolioUrl && (
										<a
											href={`${portfolioUrl}/gallery/${album.slug}`}
											target="_blank"
											rel="noopener noreferrer"
											className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
										>
											View on portfolio →
										</a>
									)}
								</li>
							))}
						</ul>
					</div>
				</>
			)}
		</div>
	);
}
