import { useRef } from "react";
import { Form, redirect } from "react-router";
import type { Route } from "./+types/albums.new";
import { getSessionUser } from "../lib/auth.server";
import { createAlbum, isValidKind } from "../lib/albums.server";
import { slugify } from "../lib/slugify";

export function meta() {
	return [{ title: "New Album — Moments Admin" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");
	return null;
}

export async function action({ request, context }: Route.ActionArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");

	const formData = await request.formData();
	const name = String(formData.get("name") ?? "").trim();
	const slug = String(formData.get("slug") ?? "").trim();
	const kind = String(formData.get("kind") ?? "portfolio");
	const description = String(formData.get("description") ?? "").trim();
	const isPublic = formData.get("isPublic") === "on";

	if (!name) {
		return { error: "Name is required" };
	}
	if (!isValidKind(kind)) {
		return { error: "Invalid album kind" };
	}

	const album = await createAlbum(context.cloudflare.env.DB, user.id, {
		name,
		slug: slug || undefined,
		kind: kind as "portfolio" | "client_delivery",
		description: description || undefined,
		isPublic,
	});

	return redirect(`/albums/${album.id}`);
}

export default function AlbumsNew({ actionData }: Route.ComponentProps) {
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
				New album
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
						placeholder="my-album"
						onFocus={handleSlugFocus}
						className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
					/>
				</div>
				<div>
					<label
						htmlFor="kind"
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>
						Kind
					</label>
					<select
						id="kind"
						name="kind"
						className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
					>
						<option value="portfolio">Portfolio</option>
						<option value="client_delivery">Client delivery</option>
					</select>
				</div>
				<div>
					<label
						htmlFor="description"
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>
						Description
					</label>
					<textarea
						id="description"
						name="description"
						rows={3}
						className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
					/>
				</div>
				<div className="flex items-center gap-2">
					<input
						id="isPublic"
						name="isPublic"
						type="checkbox"
						className="rounded border-gray-300"
					/>
					<label
						htmlFor="isPublic"
						className="text-sm text-gray-700 dark:text-gray-300"
					>
						Public (visible on portfolio)
					</label>
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
						Create
					</button>
					<a
						href="/albums"
						className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
					>
						Cancel
					</a>
				</div>
			</Form>
		</div>
	);
}
