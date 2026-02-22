# Project Description — “Moments”

## Overview

Space Structure:
- /moments - Astro website
- /moments-admin - Admin Panel React SPA

Moments is a Cloudflare-native photo platform for photographers that combines:
 - Public portfolio website (SEO-friendly)
 - Album management and tagging system
 - Client photo sharing
 - Service booking capabilities
 - Future multi-tenant marketplace potential

The system is built with:
 - Astro (frontend, deployed to Cloudflare Pages)
 - Cloudflare Workers / Pages Functions (API)
 - Cloudflare D1 (SQLite) for metadata
 - Cloudflare R2 for media storage
 - Transactional Outbox pattern for search/index synchronization

The architecture prioritizes:
 - Simplicity first (MVP ready)
 - Clean domain modeling
 - Async scalability
 - Future multi-tenancy
 - Event-driven extensibility


## Core Domain Concepts

Main entities:
 - User (photographer, client)
 - Service (offering)
 - Order (booking)
 - Album (portfolio or client delivery)
 - Item (photo/video logical object)
 - ItemAsset (media variants)
 - Tag (polymorphic tagging)
 - OutboxEvent (transactional integration events)

## Architectural Principles

### 1. Cloudflare-native

The system must rely on:
 - D1 for relational metadata
 - R2 for file storage
 - Workers/Pages Functions for API logic
 - No external DB unless explicitly required

### 2. Transactional Outbox

All public-facing changes that affect:
 - albums
 - items
 - tags
 - publish state

must also append an event to outbox_events inside the same transaction.

No dual writes to external systems.

### 3. Polymorphic Tagging

Tagging is implemented via:
 - tags
 - tag_refs(entity_type, entity_id)

Tags are normalized and indexed.
String-based tag storage is not authoritative.

### 4. Money Safety

All monetary values are stored as:
 - INTEGER cents
 - currency as ISO string

No floats allowed.

### 5. Storage Model

Media files:
 - Stored in R2
 - Referenced via item_assets.storage_key
 - Variants are normalized (original, preview, thumb)

Metadata stays in D1 only.

### 6. Eventual Consistency

Search and discovery systems must consume outbox events asynchronously.
Strong consistency is only required inside the primary D1 transaction.

Development Rules for Cursor
  1. Prefer simple SQL over abstractions.
  2. Avoid introducing ORMs unless necessary.
  3. No premature microservices.
  4. Keep schema migrations explicit.
  5. All publish-affecting changes must bump public_version.
  6. Avoid adding features that require cross-tenant joins.
  7. Multi-tenancy is per-database (not row-based), unless explicitly changed later.
  8. All enum values must be enforced in application layer.
  9. No inline SQL comments inside Mermaid diagrams.
  10. Favor deterministic IDs (ULID).

## Phase Strategy

### Phase 1 (Current Focus)
 - Single photographer
 - Album CRUD
 - Upload images
 - Tag photos
 - Public portfolio pages
 - Transactional outbox in place (even if no search index yet)

### Phase 2
 - Client album delivery
 - Service booking
 - Order lifecycle

### Phase 3
 - Multi-tenancy
 - Global search index (OpenSearch)
 - Marketplace features

## Scalability Strategy

When number of photographers grows:
 - Use one D1 database per tenant
 - Keep global discovery in OpenSearch
 - Use outbox → queue → index pipeline
 - Consider Durable Objects only for:
 - booking serialization
 - rate limiting
 - upload coordination

D1 remains the primary source of truth.


## Non-Goals
 - Real-time collaborative editing
 - Strong global transactional guarantees
 - Complex distributed locking
 - Heavy AI pipelines in core flow

## Vision

Moments is not just a gallery.

It is a structured, event-driven photo platform that:
 - treats media as domain entities
 - treats tagging as a first-class search primitive
 - treats indexing as an integration concern
 - treats publishing as versioned state
