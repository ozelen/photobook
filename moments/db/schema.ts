/**
 * Drizzle schema for Moments D1 database.
 * Used by drizzle-kit for migrations. For queries, prefer raw SQL per project rules.
 * Schema mirrors db/schema.sql - keep in sync when adding migrations.
 */
import {
	primaryKey,
	real,
	sqliteTable,
	text,
	integer,
	unique,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	role: text("role").notNull(),
	email: text("email").unique(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	bio: text("bio"),
	logoUrl: text("logo_url"),
	passwordHash: text("password_hash"),
	createdAt: text("created_at").notNull().default("(datetime('now'))"),
	updatedAt: text("updated_at"),
});

export const userAccounts = sqliteTable(
	"user_accounts",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		provider: text("provider").notNull(),
		providerAccountId: text("provider_account_id"),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		expiresAt: text("expires_at"),
		createdAt: text("created_at").notNull().default("(datetime('now'))"),
		updatedAt: text("updated_at"),
	},
	(t) => [unique().on(t.userId, t.provider)]
);

export const albums = sqliteTable(
	"albums",
	{
		id: text("id").primaryKey(),
		ownerUserId: text("owner_user_id").notNull(),
		kind: text("kind").notNull(),
		isPublic: integer("is_public").notNull().default(0),
		orderId: text("order_id"),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		model: text("model"),
		lat: real("lat"),
		lng: real("lng"),
		coverItemId: text("cover_item_id"),
		publicVersion: integer("public_version").notNull().default(0),
		createdAt: text("created_at").notNull().default("(datetime('now'))"),
		updatedAt: text("updated_at"),
	},
	(t) => [unique().on(t.ownerUserId, t.slug)]
);

export const items = sqliteTable("items", {
	id: text("id").primaryKey(),
	ownerUserId: text("owner_user_id").notNull(),
	type: text("type").notNull(),
	title: text("title"),
	description: text("description"),
	meta: text("meta"),
	takenAt: text("taken_at"),
	createdAt: text("created_at").notNull().default("(datetime('now'))"),
	updatedAt: text("updated_at"),
	deletedAt: text("deleted_at"),
});

export const itemAssets = sqliteTable(
	"item_assets",
	{
		id: text("id").primaryKey(),
		itemId: text("item_id").notNull(),
		variant: text("variant").notNull(),
		storageKey: text("storage_key").notNull(),
		contentType: text("content_type"),
		width: integer("width"),
		height: integer("height"),
		bytes: integer("bytes"),
		checksum: text("checksum"),
		createdAt: text("created_at").notNull().default("(datetime('now'))"),
	},
	(t) => [unique().on(t.itemId, t.variant)]
);

export const tags = sqliteTable("tags", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	kind: text("kind"),
	createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const tagRefs = sqliteTable(
	"tag_refs",
	{
		tagId: text("tag_id").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		createdAt: text("created_at").notNull().default("(datetime('now'))"),
	},
	(t) => [primaryKey({ columns: [t.tagId, t.entityType, t.entityId] })]
);

export const albumMembers = sqliteTable(
	"album_members",
	{
		userId: text("user_id").notNull(),
		albumId: text("album_id").notNull(),
		role: text("role").notNull(),
		createdAt: text("created_at").notNull().default("(datetime('now'))"),
	},
	(t) => [primaryKey({ columns: [t.userId, t.albumId] })]
);

export const albumItems = sqliteTable(
	"album_items",
	{
		albumId: text("album_id").notNull(),
		itemId: text("item_id").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: text("created_at").notNull().default("(datetime('now'))"),
	},
	(t) => [primaryKey({ columns: [t.albumId, t.itemId] })]
);

export const outboxEvents = sqliteTable("outbox_events", {
	id: text("id").primaryKey(),
	aggregateType: text("aggregate_type").notNull(),
	aggregateId: text("aggregate_id").notNull(),
	eventType: text("event_type").notNull(),
	payload: text("payload").notNull(),
	version: integer("version").notNull(),
	createdAt: text("created_at").notNull().default("(datetime('now'))"),
	processedAt: text("processed_at"),
});
