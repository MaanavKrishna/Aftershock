import { describe, test, expect, beforeAll } from "vitest";
import { getDb } from "@/lib/db/client";
import { seedDemo } from "@/lib/db/seed";
import * as s from "@/lib/db/schema";
import { and, eq, count } from "drizzle-orm";

describe("database", () => {
  beforeAll(async () => {
    await getDb();
  });

  test("demo seed is idempotent", async () => {
    const db = await getDb();
    const first = await seedDemo();
    const [{ n: incidents1 }] = await db.select({ n: count() }).from(s.incidents);
    const second = await seedDemo();
    const [{ n: incidents2 }] = await db.select({ n: count() }).from(s.incidents);
    expect(second.workspaceId).toBe(first.workspaceId);
    expect(incidents2).toBe(incidents1);
    expect(incidents1).toBeGreaterThanOrEqual(8);
  });

  test("INC-12 is proven with a rejected first attempt and a proven second", async () => {
    const db = await getDb();
    const { workspaceId } = await seedDemo();
    const [inc] = await db.select().from(s.incidents).where(and(eq(s.incidents.workspaceId, workspaceId), eq(s.incidents.number, 12)));
    expect(inc.status).toBe("proven");
    const runs = await db.select().from(s.timeTravelRuns).where(eq(s.timeTravelRuns.incidentId, inc.id)).orderBy(s.timeTravelRuns.attempt);
    expect(runs.map((r) => r.status)).toEqual(["rejected", "proven"]);
  });

  test("incident numbers are unique per workspace", async () => {
    const db = await getDb();
    const { workspaceId } = await seedDemo();
    await expect(
      db.insert(s.incidents).values({ workspaceId, number: 12, title: "dup", source: "form", status: "awaiting_fix" }),
    ).rejects.toThrow();
  });
});
