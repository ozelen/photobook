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
