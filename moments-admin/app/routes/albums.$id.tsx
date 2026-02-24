import { Form, Link, redirect, useRevalidator } from "react-router";
import { useRef, useState, useEffect, useCallback } from "react";
import type { Route } from "./+types/albums.$id";
import { getSessionUser } from "../lib/auth.server";
import { getAlbum, deleteAlbum } from "../lib/albums.server";
import { listAlbumItems } from "../lib/items.server";
import { getTagsForEntity, getTagsForEntities } from "../lib/tags.server";
import { getCfImageUrl, getCfImagesDeliveryUrl } from "../lib/images.server";

interface PhotoPrismAlbum {
	uid: string;
	title: string;
	description: string;
	photo_count: number;
}

interface PhotoPrismPhoto {
	uid: string;
	hash: string;
	title: string;
	taken_at: string;
}

export function meta({ params, loaderData }: Route.MetaArgs) {
	const album = loaderData?.album;
	return [{ title: album ? `${album.name} — Moments Admin` : "Album — Moments Admin" }];
}

const JPEG_EXTENSIONS = [".jpg", ".jpeg"];
function isJpeg(filename: string): boolean {
	const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
	return JPEG_EXTENSIONS.includes(ext);
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");

	const album = await getAlbum(context.cloudflare.env.DB, params.id, user.id);
	if (!album) throw new Response("Not found", { status: 404 });

	const rawItems = await listAlbumItems(context.cloudflare.env.DB, params.id, user.id);
	const albumTags = await getTagsForEntity(context.cloudflare.env.DB, "album", params.id);
	const itemTagsMap = await getTagsForEntities(
		context.cloudflare.env.DB,
		"item",
		rawItems.map((i) => i.id),
	);
	const origin = new URL(request.url).origin;
	const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
	const portfolioUrl =
		(context.cloudflare.env as { PORTFOLIO_URL?: string }).PORTFOLIO_URL ??
		"https://moments.zelen.uk";
	const cfDeliveryHash = (context.cloudflare.env as { CF_IMAGES_DELIVERY_HASH?: string })
		.CF_IMAGES_DELIVERY_HASH;
	const items = rawItems.map((item) => {
		const directCf = cfDeliveryHash && getCfImagesDeliveryUrl(item.imageId, cfDeliveryHash, "thumb");
		const thumbUrl =
			directCf
				? directCf
				: album.isPublic === 1
					? isLocal
						? `/api/public/items/${item.id}/image`
						: getCfImageUrl(
								origin,
								`${origin}/api/public/items/${item.id}/image`,
								"thumb",
							)
					: `/api/items/${item.id}/image`;
		const tags = itemTagsMap[item.id] ?? [];
		return { ...item, thumbUrl, tags };
	});

	return { album, items, albumTags, portfolioUrl };
}

export async function action({ params, request, context }: Route.ActionArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");

	const formData = await request.formData();
	const action = formData.get("_action");
	if (action === "delete") {
		const deleted = await deleteAlbum(context.cloudflare.env.DB, params.id, user.id);
		if (deleted) return redirect("/albums");
	}
	throw new Response("Bad request", { status: 400 });
}

export default function AlbumDetail({ loaderData }: Route.ComponentProps) {
	const { album, items, albumTags, portfolioUrl } = loaderData;
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [photoprismOpen, setPhotoprismOpen] = useState(false);
	const [ppAlbums, setPpAlbums] = useState<PhotoPrismAlbum[]>([]);
	const [ppPhotos, setPpPhotos] = useState<PhotoPrismPhoto[]>([]);
	const [ppSelectedAlbum, setPpSelectedAlbum] = useState<string | null>(null);
	const [ppSelectedHashes, setPpSelectedHashes] = useState<Set<string>>(new Set());
	const [ppLoading, setPpLoading] = useState(false);
	const [ppLoadingMore, setPpLoadingMore] = useState(false);
	const [ppHasMore, setPpHasMore] = useState(false);
	const [ppOffset, setPpOffset] = useState(0);
	const [ppError, setPpError] = useState<string | null>(null);
	const [ppAdding, setPpAdding] = useState(false);
	const ppScrollRef = useRef<HTMLDivElement>(null);
	const revalidator = useRevalidator();

	const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
	const [deleting, setDeleting] = useState(false);
	const [tagModalOpen, setTagModalOpen] = useState(false);
	const [tagInput, setTagInput] = useState("");
	const [tagging, setTagging] = useState(false);

	const PP_PAGE_SIZE = 24;

	useEffect(() => {
		if (!photoprismOpen) return;
		setPpError(null);
		fetch("/api/photoprism/albums")
			.then((r) => r.json())
			.then((d: unknown) => {
				const data = d as { albums?: PhotoPrismAlbum[]; error?: string };
				if (data.error) throw new Error(data.error);
				setPpAlbums(data.albums ?? []);
			})
			.catch((e) => setPpError(e instanceof Error ? e.message : "Failed to load albums"));
	}, [photoprismOpen]);

	useEffect(() => {
		if (!photoprismOpen || !ppSelectedAlbum) {
			setPpPhotos([]);
			setPpHasMore(false);
			setPpOffset(0);
			return;
		}
		setPpLoading(true);
		setPpError(null);
		setPpOffset(0);
		fetch(
			`/api/photoprism/photos?album=${ppSelectedAlbum}&offset=0&count=${PP_PAGE_SIZE}`,
		)
			.then((r) => r.json())
			.then((d: unknown) => {
				const data = d as {
					photos?: PhotoPrismPhoto[];
					hasMore?: boolean;
					error?: string;
				};
				if (data.error) throw new Error(data.error);
				setPpPhotos(data.photos ?? []);
				setPpHasMore(data.hasMore ?? false);
				setPpSelectedHashes(new Set());
			})
			.catch((e) => setPpError(e instanceof Error ? e.message : "Failed to load photos"))
			.finally(() => setPpLoading(false));
	}, [photoprismOpen, ppSelectedAlbum]);

	const loadMorePhotos = useCallback(async () => {
		if (!ppSelectedAlbum || ppLoadingMore || !ppHasMore) return;
		setPpLoadingMore(true);
		setPpError(null);
		const nextOffset = ppPhotos.length;
		try {
			const res = await fetch(
				`/api/photoprism/photos?album=${ppSelectedAlbum}&offset=${nextOffset}&count=${PP_PAGE_SIZE}`,
			);
			const data = (await res.json()) as {
				photos?: PhotoPrismPhoto[];
				hasMore?: boolean;
				error?: string;
			};
			if (data.error) throw new Error(data.error);
			setPpPhotos((prev) => [...prev, ...(data.photos ?? [])]);
			setPpHasMore(data.hasMore ?? false);
		} catch (e) {
			setPpError(e instanceof Error ? e.message : "Failed to load more");
		} finally {
			setPpLoadingMore(false);
		}
	}, [ppSelectedAlbum, ppLoadingMore, ppHasMore, ppPhotos.length]);

	useEffect(() => {
		if (!ppHasMore || ppLoadingMore || !ppSelectedAlbum) return;
		const el = ppScrollRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) loadMorePhotos();
			},
			{ root: el, rootMargin: "200px", threshold: 0 },
		);
		const sentinel = el.querySelector("[data-pp-load-more]");
		if (sentinel) observer.observe(sentinel);
		return () => observer.disconnect();
	}, [ppHasMore, ppLoadingMore, ppSelectedAlbum, loadMorePhotos]);

	async function addSelectedFromPhotoPrism() {
		if (ppSelectedHashes.size === 0) return;
		setPpAdding(true);
		setPpError(null);
		let added = 0;
		for (const hash of ppSelectedHashes) {
			const res = await fetch(`/api/albums/${album.id}/items`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ photoprismHash: hash }),
			});
			if (res.ok) added++;
		}
		setPpAdding(false);
		if (added > 0) {
			setPpSelectedHashes(new Set());
			revalidator.revalidate();
		}
		if (added < ppSelectedHashes.size) {
			setPpError(`Added ${added} of ${ppSelectedHashes.size} photos`);
		}
	}

	async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!isJpeg(file.name)) {
			setUploadError("Only JPEG images (.jpg, .jpeg) are allowed.");
			e.target.value = "";
			return;
		}
		setUploadError(null);
		setUploading(true);

		try {
			const formData = new FormData();
			formData.append("file", file);

			const res = await fetch(`/api/albums/${album.id}/upload`, {
				method: "POST",
				body: formData,
			});
			if (!res.ok) {
				const data = (await res.json()) as { error?: string };
				throw new Error(data.error ?? "Upload failed");
			}

			revalidator.revalidate();
		} catch (err) {
			setUploadError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
			e.target.value = "";
		}
	}

	async function handleDeleteSelected() {
		if (selectedItemIds.size === 0) return;
		if (!confirm(`Remove ${selectedItemIds.size} photo(s) from this album?`)) return;
		setDeleting(true);
		try {
			const res = await fetch(`/api/albums/${album.id}/items`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ itemIds: Array.from(selectedItemIds) }),
			});
			if (res.ok) {
				setSelectedItemIds(new Set());
				revalidator.revalidate();
			} else {
				const data = (await res.json()) as { error?: string };
				alert(data.error ?? "Failed to remove photos");
			}
		} finally {
			setDeleting(false);
		}
	}

	function toggleItemSelection(itemId: string) {
		setSelectedItemIds((prev) => {
			const next = new Set(prev);
			if (next.has(itemId)) next.delete(itemId);
			else next.add(itemId);
			return next;
		});
	}

	async function handleTagSelected() {
		const tagNames = tagInput
			.split(/[,\s]+/)
			.map((t) => t.trim())
			.filter(Boolean);
		if (tagNames.length === 0 || selectedItemIds.size === 0) return;
		setTagging(true);
		try {
			const res = await fetch(`/api/albums/${album.id}/items/tags`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					itemIds: Array.from(selectedItemIds),
					tagNames,
				}),
			});
			if (res.ok) {
				setTagModalOpen(false);
				setTagInput("");
				revalidator.revalidate();
			} else {
				const data = (await res.json()) as { error?: string };
				alert(data.error ?? "Failed to add tags");
			}
		} finally {
			setTagging(false);
		}
	}

	return (
		<div>
			<div className="flex justify-between items-start mb-6">
				<div>
					<h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
						{album.name}
					</h1>
					<p className="text-gray-500 dark:text-gray-400 mt-1">
						/{album.slug} · {album.kind}
						{album.isPublic ? " · Public" : " · Private"}
					</p>
				</div>
				<div className="flex gap-2">
					{album.isPublic === 1 && portfolioUrl && (
						<a
							href={`${portfolioUrl}/gallery/${album.slug}`}
							target="_blank"
							rel="noopener noreferrer"
							className="px-4 py-2 border border-gray-600 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium text-sm"
						>
							View on portfolio →
						</a>
					)}
					<Link
						to={`/albums/${album.id}/edit`}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
					>
						Edit
					</Link>
					<Form method="post">
						<input type="hidden" name="_action" value="delete" />
						<button
							type="submit"
							className="px-4 py-2 border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium text-sm"
							onClick={(e) => {
								if (!confirm("Delete this album? This cannot be undone."))
									e.preventDefault();
							}}
						>
							Delete
						</button>
					</Form>
				</div>
			</div>
			{album.description && (
				<p className="text-gray-600 dark:text-gray-300 mb-6">
					{album.description}
				</p>
			)}
			{albumTags.length > 0 && (
				<div className="flex flex-wrap gap-2 mb-6">
					{albumTags.map((t) => (
						<span
							key={t.id}
							className="px-2 py-1 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
						>
							{t.name}
						</span>
					))}
				</div>
			)}

			<div className="mb-4 flex items-center gap-3">
				<input
					ref={fileInputRef}
					type="file"
					accept=".jpg,.jpeg"
					className="hidden"
					onChange={handleFileChange}
					disabled={uploading}
				/>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					disabled={uploading}
					className="px-4 py-2 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg font-medium text-sm disabled:opacity-50"
				>
					{uploading ? "Uploading…" : "Upload"}
				</button>
				<button
					type="button"
					onClick={() => setPhotoprismOpen(true)}
					className="px-4 py-2 border border-gray-600 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium text-sm"
				>
					Add from PhotoPrism
				</button>
				{uploadError && (
					<p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
				)}
			</div>

			{photoprismOpen && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setPhotoprismOpen(false)}
				>
					<div
						className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
							<h2 className="text-lg font-semibold">Add from PhotoPrism</h2>
							<button
								type="button"
								onClick={() => setPhotoprismOpen(false)}
								className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
							>
								✕
							</button>
						</div>
						<div className="p-4 border-b border-gray-200 dark:border-gray-700">
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Album
							</label>
							<select
								value={ppSelectedAlbum ?? ""}
								onChange={(e) =>
									setPpSelectedAlbum(e.target.value || null)
								}
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
							>
								<option value="">Select album…</option>
								{ppAlbums.map((a) => (
									<option key={a.uid} value={a.uid}>
										{a.title} ({a.photo_count})
									</option>
								))}
							</select>
						</div>
						{ppError && (
							<p className="px-4 py-2 text-sm text-red-600 dark:text-red-400">
								{ppError}
							</p>
						)}
						<div
							ref={ppScrollRef}
							className="flex-1 overflow-auto p-4"
						>
							{ppLoading ? (
								<p className="text-gray-500">Loading photos…</p>
							) : ppPhotos.length > 0 ? (
								<>
									<div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
										{ppPhotos.map((p) => (
											<button
												key={p.hash}
												type="button"
												onClick={() => {
													setPpSelectedHashes((prev) => {
														const next = new Set(prev);
														if (next.has(p.hash)) next.delete(p.hash);
														else next.add(p.hash);
														return next;
													});
												}}
												className={`aspect-square rounded-lg overflow-hidden border-2 border-transparent ${
													ppSelectedHashes.has(p.hash)
														? "border-blue-500 ring-2 ring-blue-500/50"
														: "hover:border-gray-400"
												}`}
											>
												<img
													src={`/api/photoprism/thumb/${p.hash}`}
													alt=""
													loading="lazy"
													className="w-full h-full object-cover"
												/>
											</button>
										))}
									</div>
									{ppHasMore && (
										<div
											data-pp-load-more
											className="flex justify-center py-4"
										>
											<button
												type="button"
												onClick={loadMorePhotos}
												disabled={ppLoadingMore}
												className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
											>
												{ppLoadingMore ? "Loading…" : "Load more"}
											</button>
										</div>
									)}
								</>
							) : ppSelectedAlbum ? (
								<p className="text-gray-500">No photos in this album.</p>
							) : null}
						</div>
						<div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
							<span className="text-sm text-gray-500">
								{ppSelectedHashes.size} selected
							</span>
							<button
								type="button"
								onClick={addSelectedFromPhotoPrism}
								disabled={ppSelectedHashes.size === 0 || ppAdding}
								className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm"
							>
								{ppAdding ? "Adding…" : "Add selected"}
							</button>
						</div>
					</div>
				</div>
			)}

			{tagModalOpen && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setTagModalOpen(false)}
				>
					<div
						className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-4"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
							Add tags to {selectedItemIds.size} photo(s)
						</h3>
						<input
							type="text"
							value={tagInput}
							onChange={(e) => setTagInput(e.target.value)}
							placeholder="portrait, wedding, outdoors"
							className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4"
						/>
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
							Comma-separated. Tags are normalized and shared.
						</p>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setTagModalOpen(false)}
								className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleTagSelected}
								disabled={tagging || !tagInput.trim()}
								className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
							>
								{tagging ? "Adding…" : "Add tags"}
							</button>
						</div>
					</div>
				</div>
			)}

			{items.length > 0 ? (
				<>
					{selectedItemIds.size > 0 && (
						<div className="mb-4 flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
							<span className="text-sm text-gray-700 dark:text-gray-300">
								{selectedItemIds.size} selected
							</span>
							<button
								type="button"
								onClick={() => setSelectedItemIds(new Set())}
								className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
							>
								Clear
							</button>
							<button
								type="button"
								onClick={() => setTagModalOpen(true)}
								className="px-4 py-2 border border-gray-600 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium text-sm"
							>
								Tag selected
							</button>
							<button
								type="button"
								onClick={handleDeleteSelected}
								disabled={deleting}
								className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm"
							>
								{deleting ? "Removing…" : "Remove from album"}
							</button>
						</div>
					)}
					<ul className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
						{items.map((item) => (
							<li key={item.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
								<button
									type="button"
									onClick={() => toggleItemSelection(item.id)}
									className={`relative w-full h-full block text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg ${
										selectedItemIds.has(item.id)
											? "ring-2 ring-blue-500 ring-offset-2"
											: "hover:ring-2 hover:ring-gray-400 hover:ring-offset-2"
									}`}
								>
									{item.thumbUrl ? (
										<img
											src={item.thumbUrl}
											alt=""
											loading="lazy"
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
											{item.imageId}
										</div>
									)}
									{selectedItemIds.has(item.id) && (
										<span className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
											✓
										</span>
									)}
									{item.tags && item.tags.length > 0 && (
										<div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-1 p-2 bg-black/60">
											{item.tags.map((t) => (
												<span
													key={t.id}
													className="px-1.5 py-0.5 text-xs rounded bg-white/20 text-white truncate max-w-[80px]"
													title={t.name}
												>
													{t.name}
												</span>
											))}
										</div>
									)}
								</button>
							</li>
						))}
					</ul>
				</>
			) : (
				<div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
					<p className="text-gray-500 dark:text-gray-400">
						No photos yet. Click Upload to add JPEG images.
					</p>
				</div>
			)}
		</div>
	);
}
