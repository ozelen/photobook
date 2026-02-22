/**
 * Cloudflare Image Resizing (cdn-cgi/image) - transforms images from any origin.
 * Originals stay on NAS; CF fetches, transforms, caches, and serves from edge.
 */
export type ImageVariant = "thumb" | "grid" | "hero";

const VARIANT_OPTIONS: Record<ImageVariant, string> = {
	thumb: "width=500,height=500,fit=cover,quality=85",
	grid: "width=720,height=720,fit=inside,quality=85",
	hero: "width=1920,height=1080,fit=inside,quality=85",
};

/**
 * Build a Cloudflare transformation URL for an image.
 * @param origin - e.g. https://adm-moments.zelen.uk
 * @param sourceUrl - full URL to the source image (must be publicly accessible)
 * @param variant - thumb | grid | hero
 */
export function getCfImageUrl(
	origin: string,
	sourceUrl: string,
	variant: ImageVariant = "thumb",
): string {
	const base = origin.replace(/\/$/, "");
	const options = VARIANT_OPTIONS[variant];
	return `${base}/cdn-cgi/image/${options}/${sourceUrl}`;
}
