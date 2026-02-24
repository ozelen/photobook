import type { APIRoute } from "astro";
import {
	getPublicAlbums,
	getItemImageUrl,
	getPublicTags,
	getItemTagSlugs,
	getLatestTaggedItem,
	getTagBySlug,
} from "../../lib/public-albums";

const DEFAULT_HERO_TITLE = "Capturing Moments | That Last Forever";
const DEFAULT_HERO_SUBTITLE =
	"Award-winning photography specializing in portrait, landscape, and event photography that tells your unique story.";

export const GET: APIRoute = async (context) => {
	const runtime = context.locals.runtime;
	if (!runtime?.env) {
		return new Response(JSON.stringify({ error: "Server not configured" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	const tagFilter = new URL(context.request.url).searchParams.get("tag") ?? "";

	const db = runtime.env.DB as D1Database;
	const adminBaseUrl =
		(runtime.env as { ADMIN_BASE_URL?: string }).ADMIN_BASE_URL ??
		"https://adm-moments.zelen.uk";

	const albums = await getPublicAlbums(db);
	const rawItems = albums.flatMap((a) =>
		a.items.slice(0, 12).map((item) => ({
			...item,
			albumId: a.id,
			albumName: a.name,
			albumSlug: a.slug,
			thumbUrl: getItemImageUrl(adminBaseUrl, item.id, "thumb"),
		})),
	);
	const itemTagSlugs = await getItemTagSlugs(db, rawItems);
	let galleryItems = rawItems.map((item) => ({
		id: item.id,
		albumName: item.albumName,
		albumSlug: item.albumSlug,
		thumbUrl: item.thumbUrl,
		tagSlugs: itemTagSlugs[item.id] ?? [],
	}));

	if (tagFilter) {
		galleryItems = galleryItems.filter((item) =>
			item.tagSlugs.includes(tagFilter),
		);
	}

	const [topTags, heroImage, tag] = await Promise.all([
		getPublicTags(db),
		tagFilter
			? getLatestTaggedItem(db, adminBaseUrl, tagFilter)
			: getLatestTaggedItem(db, adminBaseUrl),
		tagFilter ? getTagBySlug(db, tagFilter) : null,
	]);

	const heroTitle =
		tag?.heroTitle ?? DEFAULT_HERO_TITLE;
	const heroSubtitle =
		tag?.heroSubtitle ?? DEFAULT_HERO_SUBTITLE;

	return new Response(
		JSON.stringify({
			galleryItems,
			topTags,
			heroTitle,
			heroSubtitle,
			heroImageUrl: heroImage?.thumbUrl ?? null,
			heroImageAlt: heroImage?.alt ?? null,
		}),
		{
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=60, s-maxage=60",
			},
		},
	);
};
