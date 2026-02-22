import { ulid } from "ulid";

export interface AlbumItem {
	id: string;
	imageId: string;
	sortOrder: number;
	createdAt: string;
}

export async function listAlbumItems(
	db: D1Database,
	albumId: string,
	ownerUserId: string,
): Promise<AlbumItem[]> {
	const { results } = await db
		.prepare(
			`SELECT i.id, i.image_id as imageId, ai.sort_order as sortOrder, ai.created_at as createdAt
       FROM album_items ai
       JOIN items i ON i.id = ai.item_id
       WHERE ai.album_id = ? AND i.owner_user_id = ? AND i.image_id IS NOT NULL AND i.deleted_at IS NULL
       ORDER BY ai.sort_order ASC, ai.created_at ASC`,
		)
		.bind(albumId, ownerUserId)
		.all();
	return (results ?? []) as AlbumItem[];
}

export async function isItemInPublicAlbum(
	db: D1Database,
	itemId: string,
): Promise<boolean> {
	const row = await db
		.prepare(
			`SELECT 1 FROM album_items ai
       JOIN albums a ON a.id = ai.album_id
       WHERE ai.item_id = ? AND a.is_public = 1
       LIMIT 1`,
		)
		.bind(itemId)
		.first();
	return !!row;
}

export async function addItemToAlbum(
	db: D1Database,
	albumId: string,
	ownerUserId: string,
	imageId: string,
): Promise<{ id: string } | null> {
	const album = await db
		.prepare("SELECT id FROM albums WHERE id = ? AND owner_user_id = ?")
		.bind(albumId, ownerUserId)
		.first();
	if (!album) return null;

	const maxOrder = await db
		.prepare(
			"SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM album_items WHERE album_id = ?",
		)
		.bind(albumId)
		.first();
	const sortOrder = (maxOrder as { next_order: number })?.next_order ?? 0;

	const itemId = ulid();
	const outboxId = ulid();
	const now = new Date().toISOString();
	const payload = JSON.stringify({ id: itemId, imageId, albumId });

	await db.batch([
		db
			.prepare(
				`INSERT INTO items (id, owner_user_id, type, image_id, created_at, updated_at)
         VALUES (?, ?, 'photo', ?, ?, ?)`,
			)
			.bind(itemId, ownerUserId, imageId, now, now),
		db
			.prepare(
				`INSERT INTO album_items (album_id, item_id, sort_order, created_at)
         VALUES (?, ?, ?, datetime('now'))`,
			)
			.bind(albumId, itemId, sortOrder),
		db
			.prepare(
				`INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, version, created_at)
         VALUES (?, 'item', ?, 'upsert', ?, 0, datetime('now'))`,
			)
			.bind(outboxId, itemId, payload),
	]);

	return { id: itemId };
}
