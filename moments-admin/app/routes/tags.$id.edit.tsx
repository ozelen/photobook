import { useRef } from "react";
import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/tags.$id.edit";
import { getSessionUser } from "../lib/auth.server";
import { getTag, updateTag } from "../lib/tags.server";
import { slugify } from "../lib/slugify";

export function meta({ loaderData }: Route.MetaArgs) {
	const tag = loaderData?.tag;
	return [
		{ title: tag ? `Edit ${tag.name} — Moments Admin` : "Edit Tag — Moments Admin" },
	];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");

	const tag = await getTag(context.cloudflare.env.DB, params.id);
	if (!tag) throw new Response("Not found", { status: 404 });
	return { tag };
}

export async function action({ params, request, context }: Route.ActionArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");

	const formData = await request.formData();
	const name = String(formData.get("name") ?? "").trim();
	const slug = String(formData.get("slug") ?? "").trim();
	const heroTitle = String(formData.get("heroTitle") ?? "").trim() || null;
	const heroSubtitle = String(formData.get("heroSubtitle") ?? "").trim() || null;
	const heroItemId = String(formData.get("heroItemId") ?? "").trim() || null;

	if (!name) {
		return { error: "Name is required" };
	}

	const tag = await updateTag(context.cloudflare.env.DB, params.id, {
		name,
		slug: slug || slugify(name),
		heroTitle,
		heroSubtitle,
		heroItemId,
	});
	if (tag) return redirect("/tags");
	return { error: "Failed to update" };
}

export default function TagEdit({ loaderData, actionData }: Route.ComponentProps) {
	const { tag } = loaderData;
	const slugRef = useRef<HTMLInputElement>(null);

	function handleNameInput(e: React.FormEvent<HTMLInputElement>) {
		const name = (e.target as HTMLInputElement).value;
		if (slugRef.current && !slugRef.current.dataset.manual) {
			slugRef.current.value = slugify(name);
		}
	}

	function handleSlugFocus() {
		slugRef.current?.setAttribute("data-manual", "true");
	}

	return (
		<div>
			<h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
				Edit tag
			</h1>
			<Form method="post" className="max-w-md space-y-4">
				<div>
					<label
						htmlFor="name"
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>
						Name
					</label>
					<input
						id="name"
						name="name"
						type="text"
						defaultValue={tag.name}
						required
						onInput={handleNameInput}
						className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
					/>
				</div>
				<div>
					<label
						htmlFor="slug"
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>
						Slug (auto-generated from name, edit to override)
					</label>
					<input
						ref={slugRef}
						id="slug"
						name="slug"
						type="text"
						defaultValue={tag.slug}
						onFocus={handleSlugFocus}
						className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
					/>
				</div>
				<div>
					<label
						htmlFor="heroTitle"
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>
						Hero title
					</label>
					<input
						id="heroTitle"
						name="heroTitle"
						type="text"
						defaultValue={tag.heroTitle ?? ""}
						placeholder="Capturing Moments That Last Forever"
						className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
					/>
					<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Shown when this tag is selected on the hero.
					</p>
				</div>
				<div>
					<label
						htmlFor="heroSubtitle"
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>
						Hero subtitle
					</label>
					<textarea
						id="heroSubtitle"
						name="heroSubtitle"
						rows={2}
						defaultValue={tag.heroSubtitle ?? ""}
						placeholder="Award-winning photography specializing in..."
						className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
					/>
				</div>
				<div>
					<label
						htmlFor="heroItemId"
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>
						Hero image ID
					</label>
					<input
						id="heroItemId"
						name="heroItemId"
						type="text"
						defaultValue={tag.heroItemId ?? ""}
						placeholder="Item ULID (optional)"
						className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
					/>
					<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Item ID for hero background. Leave empty to use latest tagged photo.
					</p>
				</div>
				{actionData?.error && (
					<p className="text-sm text-red-600 dark:text-red-400">
						{actionData.error}
					</p>
				)}
				<div className="flex gap-2">
					<button
						type="submit"
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
					>
						Save
					</button>
					<Link
						to="/tags"
						className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
					>
						Cancel
					</Link>
				</div>
			</Form>
		</div>
	);
}
