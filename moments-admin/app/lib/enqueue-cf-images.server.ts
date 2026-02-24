/**
 * Enqueue item for CF Images upload when adding to album.
 * No-op if CF Images not configured or imageId already in CF.
 */
import { isCfImagesConfigured, isCfImageRef } from "./cf-images.server";

export interface EnqueueEnv {
	CF_IMAGES_QUEUE?: { send: (body: unknown) => Promise<void> };
	CF_IMAGES_ACCOUNT_ID?: string;
	CF_IMAGES_API_TOKEN?: string;
	CF_IMAGES_DELIVERY_HASH?: string;
}

export async function enqueueCfImagesUpload(
	env: EnqueueEnv,
	itemId: string,
	imageId: string,
): Promise<void> {
	if (isCfImageRef(imageId)) return;
	if (!isCfImagesConfigured(env)) return;
	const queue = env.CF_IMAGES_QUEUE;
	if (!queue) return;
	await queue.send({ itemId, imageId });
}
