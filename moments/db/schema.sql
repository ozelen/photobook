-- Moments / D1 (SQLite) schema
-- Notes:
-- - Use TEXT for ULIDs.
-- - Store JSON as TEXT.
-- - Foreign keys are optional in D1; we avoid relying on them.
-- - Keep entity_type/variant/type values constrained in code (enums at app layer).

-- PRAGMA journal_mode=WAL not supported in D1

-- =========================
-- Users
-- =========================
CREATE TABLE users (
  id TEXT PRIMARY KEY,                 -- ulid
  role TEXT NOT NULL,                  -- 'admin'|'creator'|'client' (keep in code)
  email TEXT UNIQUE,                   -- optional, if you do passwordless/social auth
  first_name TEXT,
  last_name TEXT,
  bio TEXT,
  logo_url TEXT,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX idx_users_role ON users(role);

-- =========================
-- External accounts (OAuth)
-- =========================
CREATE TABLE user_accounts (
  id TEXT PRIMARY KEY,                 -- ulid
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,              -- 'google'|'apple'|'instagram' etc.
  provider_account_id TEXT,            -- optional
  access_token TEXT,
  refresh_token TEXT,
  expires_at TEXT,                     -- datetime ISO string
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_user_accounts_user ON user_accounts(user_id);

-- =========================
-- Calendars (links)
-- =========================
CREATE TABLE user_calendars (
  id TEXT PRIMARY KEY,                 -- ulid
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  link TEXT NOT NULL,                  -- url
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(user_id, link)
);

CREATE INDEX idx_user_calendars_user ON user_calendars(user_id);

-- =========================
-- Services (offerings)
-- =========================
CREATE TABLE services (
  id TEXT PRIMARY KEY,                 -- ulid
  user_id TEXT NOT NULL,               -- provider/creator
  is_active INTEGER NOT NULL DEFAULT 1,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags_text TEXT,                      -- optional denormalized, not authoritative
  price_amount INTEGER NOT NULL,        -- cents
  currency TEXT NOT NULL,              -- 'EUR'
  published_from TEXT,                 -- optional
  published_until TEXT,                -- optional
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(user_id, slug)
);

CREATE INDEX idx_services_user_active ON services(user_id, is_active);
CREATE INDEX idx_services_user_slug ON services(user_id, slug);

CREATE TABLE service_locations (
  id TEXT PRIMARY KEY,                 -- ulid
  service_id TEXT NOT NULL,
  name TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius_km REAL,                      -- optional
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_service_locations_service ON service_locations(service_id);

-- =========================
-- Orders (booking / purchase)
-- =========================
CREATE TABLE orders (
  id TEXT PRIMARY KEY,                 -- ulid
  customer_id TEXT NOT NULL,           -- user id
  provider_user_id TEXT NOT NULL,      -- snapshot for convenience (don’t rely on joining service)
  service_id TEXT,                     -- nullable if service deleted; keep snapshot fields
  service_title TEXT,                  -- snapshot
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  scheduled_at TEXT,                   -- when execution planned
  status TEXT NOT NULL,                -- 'draft'|'requested'|'confirmed'|'done'|'cancelled'
  measure TEXT,                        -- 'hour'|'set' etc (optional)
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_amount INTEGER NOT NULL,  -- snapshot cents
  discount_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,       -- snapshot cents
  currency TEXT NOT NULL               -- snapshot
);

CREATE INDEX idx_orders_customer_created ON orders(customer_id, created_at);
CREATE INDEX idx_orders_provider_created ON orders(provider_user_id, created_at);
CREATE INDEX idx_orders_status ON orders(status);

-- =========================
-- Albums
-- =========================
CREATE TABLE albums (
  id TEXT PRIMARY KEY,                 -- ulid
  owner_user_id TEXT NOT NULL,         -- creator owner
  kind TEXT NOT NULL,                  -- 'portfolio'|'client_delivery'
  is_public INTEGER NOT NULL DEFAULT 0,
  order_id TEXT,                       -- nullable, for client_delivery
  slug TEXT NOT NULL,                  -- for /portfolio/:slug
  name TEXT NOT NULL,
  description TEXT,
  model TEXT,                          -- optional, e.g. shoot/model name
  lat REAL,
  lng REAL,
  cover_item_id TEXT,                  -- optional item for cover
  public_version INTEGER NOT NULL DEFAULT 0, -- bump on publish-affecting changes
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(owner_user_id, slug)
);

CREATE INDEX idx_albums_owner_public ON albums(owner_user_id, is_public);
CREATE INDEX idx_albums_order ON albums(order_id);
CREATE INDEX idx_albums_kind_public ON albums(kind, is_public);

-- Album membership (ACL)
CREATE TABLE album_members (
  user_id TEXT NOT NULL,
  album_id TEXT NOT NULL,
  role TEXT NOT NULL,                  -- 'owner'|'editor'|'viewer'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, album_id)
);

CREATE INDEX idx_album_members_album ON album_members(album_id);

-- =========================
-- Items (logical media objects)
-- =========================
CREATE TABLE items (
  id TEXT PRIMARY KEY,                 -- ulid
  owner_user_id TEXT NOT NULL,         -- creator owner
  type TEXT NOT NULL,                  -- 'photo'|'video'|'raw'
  title TEXT,
  description TEXT,
  meta TEXT,                           -- JSON as TEXT (EXIF, camera, etc.)
  taken_at TEXT,                       -- optional (EXIF)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX idx_items_owner_created ON items(owner_user_id, created_at);
CREATE INDEX idx_items_type ON items(type);

-- Item assets (variants)
CREATE TABLE item_assets (
  id TEXT PRIMARY KEY,                 -- ulid
  item_id TEXT NOT NULL,
  variant TEXT NOT NULL,               -- 'original'|'preview'|'thumb' (extend later)
  storage_key TEXT NOT NULL,           -- R2 key
  content_type TEXT,
  width INTEGER,
  height INTEGER,
  bytes INTEGER,
  checksum TEXT,                       -- optional
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(item_id, variant)
);

CREATE INDEX idx_item_assets_item ON item_assets(item_id);
CREATE INDEX idx_item_assets_key ON item_assets(storage_key);

-- Album composition (ordered)
CREATE TABLE album_items (
  album_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(album_id, item_id)
);

CREATE INDEX idx_album_items_album_order ON album_items(album_id, sort_order);
CREATE INDEX idx_album_items_item ON album_items(item_id);

-- =========================
-- Tags (polymorphic)
-- =========================
CREATE TABLE tags (
  id TEXT PRIMARY KEY,                 -- ulid
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT,                           -- optional: 'genre'|'style'|'location'|'person'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Polymorphic references (no FK enforcement; enforce in code)
-- entity_type: 'service'|'album'|'item'
CREATE TABLE tag_refs (
  tag_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(tag_id, entity_type, entity_id)
);

CREATE INDEX idx_tagrefs_entity ON tag_refs(entity_type, entity_id);
CREATE INDEX idx_tagrefs_tag ON tag_refs(tag_id);
CREATE INDEX idx_tagrefs_entity_tag ON tag_refs(entity_type, tag_id);

-- =========================
-- Transactional Outbox (for indexing/search sync)
-- =========================
CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,                 -- ulid
  aggregate_type TEXT NOT NULL,         -- 'album'|'item'|'tag'
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,             -- 'upsert'|'delete'|'publish'|'unpublish'
  payload TEXT NOT NULL,                -- JSON snapshot for indexer
  version INTEGER NOT NULL,             -- monotonically increasing per aggregate for ordering
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT                     -- NULL until processed
);

CREATE INDEX idx_outbox_unprocessed ON outbox_events(processed_at, created_at);
CREATE INDEX idx_outbox_aggregate ON outbox_events(aggregate_type, aggregate_id);
