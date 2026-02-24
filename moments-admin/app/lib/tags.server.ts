/**
 * Tag management per architecture: normalized tags + polymorphic tag_refs.
 * entity_type: 'album' | 'item'
 */

import { ulid } from "ulid";

export interface Tag {
	id: string;
	name: string;
	slug: string;
	kind: string | null;
}

function toTag(row: Record<string, unknown>): Tag {
	return {
		id: row.id as string,
		name: row.name as string,
		slug: row.slug as string,
		kind: (row.kind as string) || null,
	};
}

function tagSlug(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "") || "untitled";
}

export async function listTags(db: D1Database): Promise<Tag[]> {
	const { results } = await db
		.prepare("SELECT id, name, slug, kind FROM tags ORDER BY name ASC")
		.all();
	return (results ?? []).map((r) => toTag(r as Record<string, unknown>));
}

export async function getOrCreateTag(
	db: D1Database,
	name: string,
): Promise<Tag | null> {
	const slug = tagSlug(name);
	if (!slug) return null;

	const existing = await db
		.prepare("SELECT id, name, slug, kind FROM tags WHERE slug = ?")
		.bind(slug)
		.first();
	if (existing) return toTag(existing as Record<string, unknown>);

	const id = ulid();
	await db
		.prepare(
			"INSERT INTO tags (id, name, slug, kind, created_at) VALUES (?, ?, ?, NULL, datetime('now'))",
		)
		.bind(id, name.trim(), slug)
		.run();
	return { id, name: name.trim(), slug, kind: null };
}

export async function getTagsForEntity(
	db: D1Database,
	entityType: "album" | "item",
	entityId: string,
): Promise<Tag[]> {
	const { results } = await db
		.prepare(
			`SELECT t.id, t.name, t.slug, t.kind
       FROM tag_refs tr
       JOIN tags t ON t.id = tr.tag_id
       WHERE tr.entity_type = ? AND tr.entity_id = ?
       ORDER BY t.name ASC`,
		)
		.bind(entityType, entityId)
		.all();
	return (results ?? []).map((r) => toTag(r as Record<string, unknown>));
}

export async function setTagsForEntity(
	db: D1Database,
	entityType: "album" | "item",
	entityId: string,
	tagNames: string[],
): Promise<Tag[]> {
	const normalized = [...new Set(tagNames.map((n) => n.trim()).filter(Boolean))];
	const tags: Tag[] = [];
	for (const name of normalized) {
		const tag = await getOrCreateTag(db, name);
		if (tag) tags.push(tag);
	}

	await db
		.prepare("DELETE FROM tag_refs WHERE entity_type = ? AND entity_id = ?")
		.bind(entityType, entityId)
		.run();

	const statements = tags.map((t) =>
		db
			.prepare(
				"INSERT INTO tag_refs (tag_id, entity_type, entity_id, created_at) VALUES (?, ?, ?, datetime('now'))",
			)
			.bind(t.id, entityType, entityId),
	);
	if (statements.length > 0) {
		await db.batch(statements);
	}
	return tags;
}

export async function addTagsToEntity(
	db: D1Database,
	entityType: "album" | "item",
	entityId: string,
	tagNames: string[],
): Promise<Tag[]> {
	const existing = await getTagsForEntity(db, entityType, entityId);
	const existingSlugs = new Set(existing.map((t) => t.slug));
	const toAdd = tagNames
		.map((n) => n.trim())
		.filter(Boolean)
		.filter((name) => !existingSlugs.has(tagSlug(name)));

	for (const name of toAdd) {
		const tag = await getOrCreateTag(db, name);
		if (tag) {
			existing.push(tag);
			existingSlugs.add(tag.slug);
			await db
				.prepare(
					"INSERT INTO tag_refs (tag_id, entity_type, entity_id, created_at) VALUES (?, ?, ?, datetime('now'))",
				)
				.bind(tag.id, entityType, entityId)
				.run();
		}
	}
	return existing;
}

export async function removeTagFromEntity(
	db: D1Database,
	entityType: "album" | "item",
	entityId: string,
	tagId: string,
): Promise<void> {
	await db
		.prepare(
			"DELETE FROM tag_refs WHERE entity_type = ? AND entity_id = ? AND tag_id = ?",
		)
		.bind(entityType, entityId, tagId)
		.run();
}

/** Returns map of entityId -> Tag[] for batch loading. */
export async function getTagsForEntities(
	db: D1Database,
	entityType: "album" | "item",
	entityIds: string[],
): Promise<Record<string, Tag[]>> {
	if (entityIds.length === 0) return {};
	const placeholders = entityIds.map(() => "?").join(",");
	const { results } = await db
		.prepare(
			`SELECT tr.entity_id, t.id, t.name, t.slug, t.kind
       FROM tag_refs tr
       JOIN tags t ON t.id = tr.tag_id
       WHERE tr.entity_type = ? AND tr.entity_id IN (${placeholders})
       ORDER BY t.name ASC`,
		)
		.bind(entityType, ...entityIds)
		.all();

	const map: Record<string, Tag[]> = {};
	for (const id of entityIds) map[id] = [];
	for (const row of (results ?? []) as { entity_id: string; id: string; name: string; slug: string; kind: string | null }[]) {
		const tag: Tag = { id: row.id, name: row.name, slug: row.slug, kind: row.kind };
		map[row.entity_id].push(tag);
	}
	return map;
}
