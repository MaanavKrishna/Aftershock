import { test, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { setGithubApi } from "@/lib/github/api";
import { refreshVisibility } from "@/lib/github/visibility";
import { ledgerWorld } from "../support/world";

afterEach(() => setGithubApi(null));

test("repositories with unknown visibility are filled in from GitHub; failures leave them unknown", async () => {
  const a = await ledgerWorld();
  const b = await ledgerWorld();
  const db = await getDb();
  setGithubApi({ repoVisibility: async (_w, fullName) => (fullName === a.repo.fullName ? false : null) });
  await refreshVisibility();
  expect((await db.select().from(s.repositories).where(eq(s.repositories.id, a.repo.id)))[0].isPrivate).toBe(false);
  expect((await db.select().from(s.repositories).where(eq(s.repositories.id, b.repo.id)))[0].isPrivate).toBeNull();
});
