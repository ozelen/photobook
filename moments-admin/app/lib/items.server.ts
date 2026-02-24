import { ulid } from "ulid";

export interface AlbumItem {
	id: string;
	imageId: string;
	sortOrder: number;
	createdAt: string;
	title: string | null;
	description: string | null;
	meta: string | null;
}

export async function listAlbumItems(
	db: D1Database,
	albumId: string,
	ownerUserId: string,
): Promise<AlbumItem[]> {
	const { results } = await db
		.prepare(
			`SELECT i.id, i.image_id as imageId, ai.sort_order as sortOrder, ai.created_at as createdAt,
        i.title, i.description, i.meta
       FROM album_items ai
       JOIN items i ON i.id = ai.item_id
       WHERE ai.album_id = ? AND i.owner_user_id = ? AND i.image_id IS NOT NULL AND i.deleted_at IS NULL
       ORDER BY ai.sort_order ASC, ai.created_at ASC`,
		)
		.bind(albumId, ownerUserId)
		.all();
	return (results ?? []) as unknown as AlbumItem[];
}

export async function updateItem(
	db: D1Database,
	itemId: string,
	ownerUserId: string,
	input: {
		title?: string | null;
		description?: string | null;
		cropMeta?: Record<string, { x: number; y: number }> | null;
	},
): Promise<boolean> {
	const updates: string[] = ["updated_at = ?"];
	const bindings: unknown[] = [new Date().toISOString()];
	if (input.title !== undefined) {
		updates.push("title = ?");
		bindings.push(input.title);
	}
	if (input.description !== undefined) {
		updates.push("description = ?");
		bindings.push(input.description);
	}
	if (input.cropMeta !== undefined) {
		const existing = await db
			.prepare("SELECT meta FROM items WHERE id = ? AND owner_user_id = ?")
			.bind(itemId, ownerUserId)
			.first();
		const meta = (existing as { meta: string | null } | null)?.meta;
		const parsed = meta ? (JSON.parse(meta) as Record<string, unknown>) : {};
		parsed.crop = input.cropMeta;
		updates.push("meta = ?");
		bindings.push(JSON.stringify(parsed));
	}
	bindings.push(itemId, ownerUserId);
	const result = await db
		.prepare(
			`UPDATE items SET ${updates.join(", ")} WHERE id = ? AND owner_user_id = ?`,
		)
		.bind(...bindings)
		.run();
	const meta = result.meta as { changes?: number } | undefined;
	return (meta?.changes ?? 0) > 0;
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
	options?: { meta?: Record<string, unknown> },
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
	const metaJson = options?.meta ? JSON.stringify(options.meta) : null;

	await db.batch([
		db
			.prepare(
				`INSERT INTO items (id, owner_user_id, type, image_id, meta, created_at, updated_at)
         VALUES (?, ?, 'photo', ?, ?, ?, ?)`,
			)
			.bind(itemId, ownerUserId, imageId, metaJson, now, now),
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

export async function removeItemsFromAlbum(
	db: D1Database,
	albumId: string,
	itemIds: string[],
	ownerUserId: string,
): Promise<{ removed: number } | null> {
	const album = await db
		.prepare(
			"SELECT id, cover_item_id, is_public, public_version FROM albums WHERE id = ? AND owner_user_id = ?",
		)
		.bind(albumId, ownerUserId)
		.first();
	if (!album) return null;

	const a = album as {
		id: string;
		cover_item_id: string | null;
		is_public: number;
		public_version: number;
	};
	const coverItemId = a.cover_item_id;
	const isPublic = a.is_public === 1;
	const newVersion = a.public_version + 1;

	const validIds = itemIds.filter(Boolean);
	if (validIds.length === 0) return { removed: 0 };

	const statements: D1PreparedStatement[] = [];
	for (const itemId of validIds) {
		statements.push(
			db.prepare("DELETE FROM album_items WHERE album_id = ? AND item_id = ?").bind(albumId, itemId),
		);
	}

	const needAlbumUpdate = (coverItemId != null && validIds.includes(coverItemId)) || isPublic;
	if (needAlbumUpdate) {
		const now = new Date().toISOString();
		statements.push(
			db
				.prepare(
					`UPDATE albums SET cover_item_id = CASE WHEN cover_item_id = ? THEN NULL ELSE cover_item_id END, public_version = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?`,
				)
				.bind(coverItemId ?? "", newVersion, now, albumId, ownerUserId),
		);
	}
	if (isPublic) {
		statements.push(
			db
				.prepare(
					`INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, version, created_at)
           VALUES (?, 'album', ?, 'upsert', ?, ?, datetime('now'))`,
				)
				.bind(ulid(), albumId, JSON.stringify({ id: albumId, removedItemIds: validIds }), newVersion),
		);
	}

	await db.batch(statements);
	return { removed: validIds.length };
}
