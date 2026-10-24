import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { setStartOverride } from "@/lib/workflows/start";
import { recordActivity, deliverDue, type Sender } from "@/lib/notify/outbox";

let started: string[] = [];
beforeEach(() => {
  started = [];
  setStartOverride((kind, id) => started.push(`${kind}:${id}`));
});
afterEach(() => setStartOverride(null));

async function world(flag = true) {
  const db = await getDb();
  const login = `ntf-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login, settings: { flags: { notifications: flag } } }).returning();
  const [inc] = await db.insert(s.incidents).values({ workspaceId: ws.id, number: 3, title: "Totals overflow", observed: "x", source: "form", status: "proven" }).returning();
  const [slack, hook] = await db.insert(s.notificationTargets).values([
    { workspaceId: ws.id, kind: "slack", name: "#incidents", urlCiphertext: encrypt("https://hooks.slack.com/services/T/B/x"), events: ["incident.proven", "pr.blocked"] },
    { workspaceId: ws.id, kind: "webhook", name: "ops", urlCiphertext: encrypt("https://ops.example.com/h"), secretCiphertext: encrypt("whsec_" + Buffer.from("k".repeat(24)).toString("base64")), events: ["pr.blocked"] },
  ]).returning();
  const outbox = () => db.select().from(s.notifications).where(eq(s.notifications.workspaceId, ws.id));
  const target = async (id: string) => (await db.select().from(s.notificationTargets).where(eq(s.notificationTargets.id, id)))[0];
  return { db, ws, inc, slack, hook, outbox, target };
}

describe("recordActivity", () => {
  test("writes the activity and queues one notification per subscribed target, then starts delivery", async () => {
    const w = await world();
    await recordActivity({ workspaceId: w.ws.id, incidentId: w.inc.id, title: "INC-3 proven", detail: "tests/test_totals.py", tone: "pass", event: "incident.proven" });
    const acts = await w.db.select().from(s.activity).where(eq(s.activity.workspaceId, w.ws.id));
    expect(acts.map((a) => a.title)).toEqual(["INC-3 proven"]);
    const rows = await w.outbox();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ targetId: w.slack.id, event: "incident.proven", status: "pending" });
    expect(rows[0].payload).toMatchObject({ title: "INC-3 proven", incident: "INC-3", workspace: w.ws.login });
    expect(String(rows[0].payload.url)).toMatch(/\/incidents\/3$/);
    expect(started).toEqual([`notify:${w.ws.id}`]);
  });
  test("an event both targets want reaches both", async () => {
    const w = await world();
    await recordActivity({ workspaceId: w.ws.id, title: "PR #41 blocked", tone: "fail", event: "pr.blocked" });
    expect((await w.outbox()).map((r) => r.targetId).sort()).toEqual([w.slack.id, w.hook.id].sort());
  });
  test("with the flag off, or for disabled targets, or without an event, nothing is queued", async () => {
    const off = await world(false);
    await recordActivity({ workspaceId: off.ws.id, title: "PR blocked", event: "pr.blocked" });
    expect(await off.outbox()).toEqual([]);
    const on = await world();
    await on.db.update(s.notificationTargets).set({ enabled: false }).where(eq(s.notificationTargets.workspaceId, on.ws.id));
    await recordActivity({ workspaceId: on.ws.id, title: "PR blocked", event: "pr.blocked" });
    await recordActivity({ workspaceId: on.ws.id, title: "Time travel started" });
    expect(await on.outbox()).toEqual([]);
    expect(started).toEqual([]);
  });
});

describe("deliverDue", () => {
  const ok: Sender = async () => ({ ok: true, status: "200" });
  const down: Sender = async () => ({ ok: false, status: "503" });

  test("successful deliveries are marked sent and reset the target's failure count", async () => {
    const w = await world();
    await w.db.update(s.notificationTargets).set({ consecutiveFailures: 4 }).where(eq(s.notificationTargets.id, w.slack.id));
    await recordActivity({ workspaceId: w.ws.id, title: "INC-3 proven", event: "incident.proven" });
    const r = await deliverDue({ workspaceId: w.ws.id, send: ok });
    expect(r).toMatchObject({ sent: 1, failed: 0, retrying: 0 });
    expect((await w.outbox())[0]).toMatchObject({ status: "sent", attempts: 1 });
    expect(await w.target(w.slack.id)).toMatchObject({ consecutiveFailures: 0, lastStatus: "200" });
  });
  test("failures back off, then give up after five attempts", async () => {
    const w = await world();
    await recordActivity({ workspaceId: w.ws.id, title: "INC-3 proven", event: "incident.proven" });
    let now = new Date("2026-10-24T10:00:00Z");
    await w.db.update(s.notifications).set({ nextAttemptAt: now }).where(eq(s.notifications.workspaceId, w.ws.id));
    const first = await deliverDue({ workspaceId: w.ws.id, send: down, now });
    expect(first).toMatchObject({ sent: 0, retrying: 1 });
    expect(first.nextAt?.toISOString()).toBe("2026-10-24T10:00:30.000Z");
    expect(await deliverDue({ workspaceId: w.ws.id, send: down, now })).toMatchObject({ retrying: 0, sent: 0 }); // not due yet
    for (const ms of [30_000, 120_000, 600_000, 3_600_000]) {
      now = new Date(now.getTime() + ms);
      await deliverDue({ workspaceId: w.ws.id, send: down, now });
    }
    expect((await w.outbox())[0]).toMatchObject({ status: "failed", attempts: 5, lastError: "503" });
  });
  test("a target that keeps failing is switched off with a reason", async () => {
    const w = await world();
    await w.db.update(s.notificationTargets).set({ consecutiveFailures: 9 }).where(eq(s.notificationTargets.id, w.slack.id));
    await recordActivity({ workspaceId: w.ws.id, title: "INC-3 proven", event: "incident.proven" });
    await deliverDue({ workspaceId: w.ws.id, send: down });
    expect(await w.target(w.slack.id)).toMatchObject({ enabled: false, consecutiveFailures: 10 });
    expect((await w.target(w.slack.id)).disabledReason).toMatch(/10 failed deliveries/);
  });
  test("queued rows for a target that was switched off are dropped, not sent", async () => {
    const w = await world();
    await recordActivity({ workspaceId: w.ws.id, title: "INC-3 proven", event: "incident.proven" });
    await w.db.update(s.notificationTargets).set({ enabled: false }).where(eq(s.notificationTargets.id, w.slack.id));
    let calls = 0;
    await deliverDue({ workspaceId: w.ws.id, send: async () => (calls++, { ok: true, status: "200" }) });
    expect(calls).toBe(0);
    expect((await w.outbox())[0]).toMatchObject({ status: "failed", lastError: "target disabled" });
  });
  test("two deliverers running at once send each row once", async () => {
    const w = await world();
    await recordActivity({ workspaceId: w.ws.id, title: "PR blocked", event: "pr.blocked" });
    let calls = 0;
    const slow: Sender = async () => (calls++, await new Promise((r) => setTimeout(r, 20)), { ok: true, status: "200" });
    await Promise.all([deliverDue({ workspaceId: w.ws.id, send: slow }), deliverDue({ workspaceId: w.ws.id, send: slow })]);
    expect(calls).toBe(2);
    expect((await w.outbox()).every((r) => r.status === "sent")).toBe(true);
  });
  test("a sender that throws counts as a failed attempt", async () => {
    const w = await world();
    await recordActivity({ workspaceId: w.ws.id, title: "INC-3 proven", event: "incident.proven" });
    await deliverDue({ workspaceId: w.ws.id, send: async () => { throw new Error("Refused: x resolves to a private address"); } });
    expect((await w.outbox())[0]).toMatchObject({ status: "pending", attempts: 1, lastError: "Refused: x resolves to a private address" });
  });
});
