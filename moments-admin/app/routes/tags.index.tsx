import { Link } from "react-router";
import type { Route } from "./+types/tags.index";
import { getSessionUser } from "../lib/auth.server";
import { listTags } from "../lib/tags.server";

export function meta() {
	return [{ title: "Tags — Moments Admin" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return { tags: [] };
	const tags = await listTags(context.cloudflare.env.DB);
	return { tags };
}

export default function TagsIndex({ loaderData }: Route.ComponentProps) {
	const { tags } = loaderData;

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
					Tags
				</h1>
			</div>
			<p className="text-gray-600 dark:text-gray-400 mb-6">
				Tags appear as gallery filters and hero CTAs. Edit a tag to set its hero
				title, subtitle, and image.
			</p>
			{tags.length === 0 ? (
				<div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
					<p className="text-gray-600 dark:text-gray-400">
						No tags yet. Tags are created when you add them to albums or photos.
					</p>
				</div>
			) : (
				<ul className="space-y-3">
					{tags.map((tag) => (
						<li
							key={tag.id}
							className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
						>
							<div>
								<span className="font-medium text-gray-900 dark:text-white">
									{tag.name}
								</span>
								<span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
									/{tag.slug}
								</span>
								{(tag.heroTitle || tag.heroSubtitle) && (
									<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
										Hero: {tag.heroTitle || tag.heroSubtitle || "—"}
									</p>
								)}
							</div>
							<Link
								to={`/tags/${tag.id}/edit`}
								className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
							>
								Edit
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
