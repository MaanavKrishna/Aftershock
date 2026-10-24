import { test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { badgeSvg } from "@/lib/badge";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST } from "../support/fixtureRepo";

async function badgeWorld(opts: { flag?: boolean; isPrivate?: boolean | null } = {}) {
  const w = await ledgerWorld();
  const db = await getDb();
  const fullName = `acme-${crypto.randomUUID().slice(0, 6)}/shop`;
  await db.update(s.workspaces).set({ settings: { flags: { badge: opts.flag ?? true } } }).where(eq(s.workspaces.id, w.ws.id));
  await db.update(s.repositories).set({ fullName, isPrivate: opts.isPrivate === undefined ? false : opts.isPrivate }).where(eq(s.repositories.id, w.repo.id));
  await db.insert(s.memoryTests).values([
    { workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, path: "a.py", fn: "t", code: LEDGER_TEST },
    { workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, path: "b.py", fn: "t", code: LEDGER_TEST, health: "failing" },
  ]);
  const [owner, repo] = fullName.split("/");
  return { ...w, db, owner, repo };
}

const get = async (owner: string, repo: string) => {
  const { GET } = await import("@/app/api/badge/[owner]/[repo]/route");
  return GET(new NextRequest(`http://x/api/badge/${owner}/${repo}`), { params: Promise.resolve({ owner, repo }) });
};

test("a public repository's badge counts its memory tests and flags failing ones", async () => {
  const w = await badgeWorld();
  const res = await get(w.owner, `${w.repo}.svg`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
  expect(res.headers.get("cache-control")).toContain("s-maxage");
  const svg = await res.text();
  expect(svg).toContain("incidents remembered");
  expect(svg).toContain("2 · 1 failing");
});

test("private, unknown-visibility, flag-off and unknown repositories all answer the same 404", async () => {
  for (const o of [{ isPrivate: true }, { isPrivate: null }, { flag: false }]) {
    const w = await badgeWorld(o);
    const res = await get(w.owner, w.repo);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("remembered");
  }
  expect((await get("nobody", "nothing")).status).toBe(404);
});

test("badge text is escaped", () => {
  expect(badgeSvg("a<b", "c&d", "pass")).toContain("a&lt;b");
  expect(badgeSvg("a<b", "c&d", "pass")).toContain("c&amp;d");
});
