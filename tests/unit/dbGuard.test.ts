import { test, expect } from "vitest";
import { databaseMode } from "@/lib/db/client";

test("Vercel without DATABASE_URL is a clear configuration error, not a local database", () => {
  expect(() => databaseMode({ VERCEL: "1" })).toThrow(/DATABASE_URL/);
});
test("DATABASE_URL selects Neon; otherwise local PGlite", () => {
  expect(databaseMode({ DATABASE_URL: "postgres://x" })).toBe("neon");
  expect(databaseMode({})).toBe("pglite");
  expect(databaseMode({ AFTERSHOCK_DB: "memory" })).toBe("memory");
});
