import { describe, it, expect } from "vitest";
import { createDb } from "./db";

describe("createDb", () => {
	it("returns a drizzle instance", () => {
		const mockD1 = {} as D1Database;
		const db = createDb(mockD1);
		expect(db).toBeDefined();
		expect(typeof db.select).toBe("function");
	});
});
