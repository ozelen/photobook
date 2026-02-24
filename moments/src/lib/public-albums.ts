/**
 * Fetch public albums and their items for the portfolio.
 * Uses raw SQL per project rules.
 */

export interface PublicAlbumItem {
	id: string;
	imageId: string | null;
	sortOrder: number;
}

export interface PublicAlbum {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	coverItemId: string | null;
	items: PublicAlbumItem[];
}

export async function getPublicAlbums(db: D1Database): Promise<PublicAlbum[]> {
	const albums = await db
		.prepare(
			`SELECT id, slug, name, description, cover_item_id
       FROM albums
       WHERE is_public = 1
       ORDER BY order_id ASC, created_at ASC`,
		)
		.all();

	const rows = (albums.results ?? []) as {
		id: string;
		slug: string;
		name: string;
		description: string | null;
		cover_item_id: string | null;
	}[];

	const result: PublicAlbum[] = [];
	for (const a of rows) {
		const items = await db
			.prepare(
				`SELECT i.id, i.image_id as imageId, ai.sort_order as sortOrder
         FROM album_items ai
         JOIN items i ON i.id = ai.item_id AND i.deleted_at IS NULL AND i.image_id IS NOT NULL
         WHERE ai.album_id = ?
         ORDER BY ai.sort_order ASC, ai.created_at ASC`,
			)
			.bind(a.id)
			.all();

		result.push({
			id: a.id,
			slug: a.slug,
			name: a.name,
			description: a.description,
			coverItemId: a.cover_item_id,
			items: (items.results ?? []) as PublicAlbumItem[],
		});
	}
	return result;
}

export function getItemImageUrl(adminBaseUrl: string, itemId: string): string {
	const base = adminBaseUrl.replace(/\/$/, "");
	return `${base}/api/public/items/${itemId}/image`;
}

export interface PublicTag {
	id: string;
	name: string;
	slug: string;
	count: number;
}

/** Returns map of entityId -> tag slugs. entityType: 'album' | 'item'. */
async function getTagSlugsForEntities(
	db: D1Database,
	entityType: "album" | "item",
	entityIds: string[],
): Promise<Record<string, string[]>> {
	if (entityIds.length === 0) return {};
	const placeholders = entityIds.map(() => "?").join(",");
	const { results } = await db
		.prepare(
			`SELECT tr.entity_id, t.slug
       FROM tag_refs tr
       JOIN tags t ON t.id = tr.tag_id
       WHERE tr.entity_type = ? AND tr.entity_id IN (${placeholders})
       ORDER BY t.name ASC`,
		)
		.bind(entityType, ...entityIds)
		.all();

	const map: Record<string, string[]> = {};
	for (const id of entityIds) map[id] = [];
	for (const row of (results ?? []) as { entity_id: string; slug: string }[]) {
		if (!map[row.entity_id].includes(row.slug)) map[row.entity_id].push(row.slug);
	}
	return map;
}

/** Returns map of itemId -> tag slugs (item tags + album tags). */
export async function getItemTagSlugs(
	db: D1Database,
	items: { id: string; albumId: string }[],
): Promise<Record<string, string[]>> {
	if (items.length === 0) return {};
	const itemIds = items.map((i) => i.id);
	const albumIds = [...new Set(items.map((i) => i.albumId))];
	const [itemTags, albumTags] = await Promise.all([
		getTagSlugsForEntities(db, "item", itemIds),
		getTagSlugsForEntities(db, "album", albumIds),
	]);

	const map: Record<string, string[]> = {};
	for (const item of items) {
		const slugs = new Set<string>([...(itemTags[item.id] ?? [])]);
		if (albumTags[item.albumId]) {
			for (const s of albumTags[item.albumId]) slugs.add(s);
		}
		map[item.id] = [...slugs];
	}
	return map;
}

/** Top tags used on public albums and items, ordered by usage count. */
export async function getPublicTags(db: D1Database, limit = 20): Promise<PublicTag[]> {
	const { results } = await db
		.prepare(
			`SELECT t.id, t.name, t.slug, COUNT(*) as count
       FROM tag_refs tr
       JOIN tags t ON t.id = tr.tag_id
       WHERE
         (tr.entity_type = 'album' AND tr.entity_id IN (SELECT id FROM albums WHERE is_public = 1))
         OR
         (tr.entity_type = 'item' AND tr.entity_id IN (
           SELECT ai.item_id FROM album_items ai
           JOIN albums a ON a.id = ai.album_id AND a.is_public = 1
           JOIN items i ON i.id = ai.item_id AND i.deleted_at IS NULL
         ))
       GROUP BY t.id, t.name, t.slug
       ORDER BY count DESC
       LIMIT ?`,
		)
		.bind(limit)
		.all();
	return (results ?? []) as PublicTag[];
}
