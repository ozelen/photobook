/**
 * Cloudflare Image Resizing (cdn-cgi/image) - transforms images from any origin.
 * Originals stay on NAS; CF fetches, transforms, caches, and serves from edge.
 * Items in CF Images use imagedelivery.net directly (no proxy).
 */
import { fromCfImageRef } from "./cf-images.server";

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

/** CF Images variant names (configure in dashboard: thumb, grid, hero) */
const CF_IMAGES_VARIANTS: Record<ImageVariant, string> = {
	thumb: "thumbnail",
	grid: "public",
	hero: "public",
};

/**
 * Direct imagedelivery.net URL for items already in CF Images.
 * Use when image_id starts with cf: — no proxy needed.
 */
export function getCfImagesDeliveryUrl(
	imageId: string,
	deliveryHash: string,
	variant: ImageVariant = "thumb",
): string | null {
	const cfId = fromCfImageRef(imageId);
	if (!cfId) return null;
	const v = CF_IMAGES_VARIANTS[variant];
	return `https://imagedelivery.net/${deliveryHash}/${cfId}/${v}`;
}
