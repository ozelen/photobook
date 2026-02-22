import { drizzle } from "drizzle-orm/d1";

/**
 * Create a Drizzle client for D1. Use for type-safe queries.
 * Prefer raw SQL for complex queries per project rules.
 */
export function createDb(d1: D1Database) {
	return drizzle(d1);
}
