/**
 * Queue consumer logic: fetch image from NAS, upload to CF Images, update item.
 */
import { ulid } from "ulid";
import { getSourceUrlForCfUpload } from "./cf-images-source-url.server";
import {
	uploadFromUrl,
	toCfImageRef,
	isCfImagesConfigured,
	isCfImageRef,
} from "./cf-images.server";

export interface CfImagesQueueMessage {
	itemId: string;
	imageId: string;
}

export interface CfImagesQueueEnv {
	DB: D1Database;
	CF_IMAGES_ACCOUNT_ID?: string;
	CF_IMAGES_API_TOKEN?: string;
	CF_IMAGES_DELIVERY_HASH?: string;
	PHOTOPRISM_BASE_URL?: string;
	WEBDAV_BASE_URL?: string;
	WEBDAV_USERNAME?: string;
	WEBDAV_PASSWORD?: string;
}

export async function processCfImagesUpload(
	message: CfImagesQueueMessage,
	env: CfImagesQueueEnv,
): Promise<void> {
	const { itemId, imageId } = message;
	if (!itemId || !imageId) return;
	if (isCfImageRef(imageId)) return; // Already in CF Images
	if (!isCfImagesConfigured(env)) return;

	const sourceUrl = await getSourceUrlForCfUpload(imageId, env);
	if (!sourceUrl) return;

	const cfId = await uploadFromUrl(
		env.CF_IMAGES_ACCOUNT_ID!,
		env.CF_IMAGES_API_TOKEN!,
		sourceUrl,
	);
	const newImageId = toCfImageRef(cfId);

	const albumRow = await env.DB.prepare(
		"SELECT album_id FROM album_items WHERE item_id = ? LIMIT 1",
	)
		.bind(itemId)
		.first();
	const albumId = (albumRow as { album_id: string } | null)?.album_id ?? "";

	const outboxId = ulid();
	const payload = JSON.stringify({ id: itemId, imageId: newImageId, albumId });

	await env.DB.batch([
		env.DB.prepare(
			"UPDATE items SET image_id = ?, updated_at = datetime('now') WHERE id = ?",
		)
			.bind(newImageId, itemId),
		env.DB.prepare(
			`INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, version, created_at)
       VALUES (?, 'item', ?, 'upsert', ?, 0, datetime('now'))`,
		)
			.bind(outboxId, itemId, payload),
	]);
}
