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

export type ImageVariant = "thumb" | "hero";

export function getItemImageUrl(
	adminBaseUrl: string,
	itemId: string,
	variant: ImageVariant = "thumb",
): string {
	const base = adminBaseUrl.replace(/\/$/, "");
	return `${base}/api/public/items/${itemId}/image?variant=${variant}`;
}

export interface PublicTag {
	id: string;
	name: string;
	slug: string;
	count: number;
	heroTitle?: string | null;
	heroSubtitle?: string | null;
	heroItemId?: string | null;
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

/** Get tag by slug, or null if not found. */
export async function getTagBySlug(
	db: D1Database,
	slug: string,
): Promise<PublicTag | null> {
	const { results } = await db
		.prepare(
			`SELECT t.id, t.name, t.slug, t.hero_title, t.hero_subtitle, t.hero_item_id, 0 as count
       FROM tags t
       WHERE t.slug = ?`,
		)
		.bind(slug)
		.all();
	const row = (results ?? [])[0] as {
		id: string;
		name: string;
		slug: string;
		hero_title: string | null;
		hero_subtitle: string | null;
		hero_item_id: string | null;
	} | undefined;
	return row
		? {
				...row,
				count: 0,
				heroTitle: row.hero_title ?? null,
				heroSubtitle: row.hero_subtitle ?? null,
				heroItemId: row.hero_item_id ?? null,
			}
		: null;
}

/** Most recently tagged item (by tag_refs.created_at) for a tag, or any tag if tagSlug empty.
 * When tagSlug is set and the tag has hero_item_id, uses that item instead. */
export async function getLatestTaggedItem(
	db: D1Database,
	adminBaseUrl: string,
	tagSlug?: string,
): Promise<{ itemId: string; thumbUrl: string; alt: string } | null> {
	const base = adminBaseUrl.replace(/\/$/, "");

	let itemId: string | null = null;

	if (tagSlug) {
		const tagRow = await db
			.prepare("SELECT hero_item_id FROM tags WHERE slug = ?")
			.bind(tagSlug)
			.first();
		const heroItemId = (tagRow as { hero_item_id: string | null } | undefined)
			?.hero_item_id;
		if (heroItemId) {
			const inPublic = await db
				.prepare(
					`SELECT a.name FROM album_items ai
         JOIN albums a ON a.id = ai.album_id AND a.is_public = 1
         JOIN items i ON i.id = ai.item_id AND i.deleted_at IS NULL AND i.image_id IS NOT NULL
         WHERE ai.item_id = ?
         LIMIT 1`,
				)
				.bind(heroItemId)
				.first();
			if (inPublic) itemId = heroItemId;
		}
	}

	if (!itemId) {
		const itemQuery = tagSlug
			? `SELECT tr.entity_id as item_id, tr.created_at
         FROM tag_refs tr
         JOIN tags t ON t.id = tr.tag_id AND t.slug = ?
         WHERE tr.entity_type = 'item'
         ORDER BY tr.created_at DESC
         LIMIT 1`
			: `SELECT tr.entity_id as item_id, tr.created_at
         FROM tag_refs tr
         WHERE tr.entity_type = 'item'
         ORDER BY tr.created_at DESC
         LIMIT 1`;

		const stmt = tagSlug
			? db.prepare(itemQuery).bind(tagSlug)
			: db.prepare(itemQuery);
		const { results } = await stmt.all();
		const row = (results ?? [])[0] as { item_id: string } | undefined;
		if (!row) return null;
		itemId = row.item_id;
	}
	const inPublicAlbum = await db
		.prepare(
			`SELECT a.name FROM album_items ai
       JOIN albums a ON a.id = ai.album_id AND a.is_public = 1
       JOIN items i ON i.id = ai.item_id AND i.deleted_at IS NULL AND i.image_id IS NOT NULL
       WHERE ai.item_id = ?
       LIMIT 1`,
		)
		.bind(itemId)
		.first();
	if (!inPublicAlbum) return null;

	const albumName = (inPublicAlbum as { name: string }).name ?? "Photo";
	return {
		itemId,
		thumbUrl: getItemImageUrl(base, itemId, "hero"),
		alt: albumName,
	};
}

/** Top tags used on public albums and items, ordered by usage count. */
export async function getPublicTags(db: D1Database, limit = 20): Promise<PublicTag[]> {
	const { results } = await db
		.prepare(
			`SELECT t.id, t.name, t.slug, t.hero_title, t.hero_subtitle, t.hero_item_id, COUNT(*) as count
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
       GROUP BY t.id, t.name, t.slug, t.hero_title, t.hero_subtitle, t.hero_item_id
       ORDER BY count DESC
       LIMIT ?`,
		)
		.bind(limit)
		.all();
	const rows = (results ?? []) as {
		id: string;
		name: string;
		slug: string;
		hero_title: string | null;
		hero_subtitle: string | null;
		hero_item_id: string | null;
		count: number;
	}[];
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		slug: r.slug,
		count: r.count,
		heroTitle: r.hero_title ?? null,
		heroSubtitle: r.hero_subtitle ?? null,
		heroItemId: r.hero_item_id ?? null,
	}));
}
