import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for generating migrations.
 * Apply migrations with: wrangler d1 migrations apply moments-db --local|--remote
 */
export default defineConfig({
	schema: "./db/schema.ts",
	out: "./db/migrations",
	dialect: "sqlite",
});
