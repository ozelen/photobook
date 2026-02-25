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
	hero: "width=1920,height=1080,fit=cover,quality=90",
};

const VARIANT_DIMENSIONS: Record<ImageVariant, { w: number; h: number }> = {
	thumb: { w: 500, h: 500 },
	grid: { w: 720, h: 720 },
	hero: { w: 1920, h: 1080 },
};

/**
 * Build a Cloudflare transformation URL for an image.
 * @param origin - e.g. https://adm-moments.zelen.uk
 * @param sourceUrl - full URL to the source image (must be publicly accessible)
 * @param variant - thumb | grid | hero
 * @param gravity - optional focal point {x,y} 0-1 for fit=cover
 * @param zoom - optional zoom (1 = normal, 2 = 2x zoomed in). Larger output, more crop.
 */
export function getCfImageUrl(
	origin: string,
	sourceUrl: string,
	variant: ImageVariant = "thumb",
	gravity?: { x: number; y: number },
	zoom = 1,
): string {
	const base = origin.replace(/\/$/, "");
	const dims = VARIANT_DIMENSIONS[variant];
	const zw = Math.round(dims.w * zoom);
	const zh = Math.round(dims.h * zoom);
	let options = VARIANT_OPTIONS[variant].replace(
		/width=\d+,height=\d+/,
		`width=${zw},height=${zh}`,
	);
	if (gravity && (variant === "thumb" || variant === "hero")) {
		const x = Math.round(gravity.x * 100) / 100;
		const y = Math.round(gravity.y * 100) / 100;
		options = `${options},gravity=${x}x${y}`;
	}
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
