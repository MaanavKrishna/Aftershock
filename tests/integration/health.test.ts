import { test, expect } from "vitest";

test("health reports the database round trip and version, without caching or secrets", async () => {
  const { GET } = await import("@/app/api/health/route");
  const res = await GET();
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, version: "0.2.1", db: { ok: true } });
  expect(typeof body.db.ms).toBe("number");
  expect(JSON.stringify(body)).not.toMatch(/postgres|secret|key/i);
});
