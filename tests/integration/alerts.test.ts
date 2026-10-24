import { describe, test, expect } from "vitest";
import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { POST as sentry } from "@/app/api/webhooks/sentry/route";
import { POST as pagerduty } from "@/app/api/webhooks/pagerduty/route";

async function world() {
  const db = await getDb();
  const login = `alerts-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login }).returning();
  const [repo] = await db.insert(s.repositories).values({ workspaceId: ws.id, fullName: `${login}/ecommerce-api`, name: "ecommerce-api", cloneUrl: "https://github.com/x/y.git", framework: "pytest", installCmd: "pip install -r requirements.txt" }).returning();
  await db.insert(s.integrations).values([
    { workspaceId: ws.id, kind: "sentry", config: { projects: "shop-backend:ecommerce-api" }, secretCiphertext: encrypt("sentry-secret") },
    { workspaceId: ws.id, kind: "pagerduty", config: { services: "payments:ecommerce-api" }, secretCiphertext: encrypt("pd-secret") },
  ]);
  const incidents = () => db.select().from(s.incidents).where(eq(s.incidents.workspaceId, ws.id));
  const deliveries = (kind: string) => db.select().from(s.deliveries).where(and(eq(s.deliveries.workspaceId, ws.id), eq(s.deliveries.kind, kind)));
  return { ws, repo, incidents, deliveries };
}

const hmac = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("hex");
const sentryBody = (id = "4512") => JSON.stringify({ action: "created", data: { issue: { id, title: "IntegrityError: duplicate key value", culprit: "app/services/order_service.py in create_order", level: "error", project: { slug: "shop-backend" }, permalink: "https://sentry.io/x" } } });
const sentryReq = (login: string, body: string, sig: string | null) => new NextRequest(`http://localhost/api/webhooks/sentry?workspace=${login}`, { method: "POST", body, headers: sig ? { "sentry-hook-signature": sig, "sentry-hook-resource": "issue" } : {} });
const pdBody = JSON.stringify({ event: { event_type: "incident.resolved", data: { id: "P8K2QX", title: "Worker crash loop when queue is empty", service: { summary: "payments" }, html_url: "https://pd/x" } } });

describe("Sentry", () => {
  test("a signed new issue opens an incident awaiting its fix", async () => {
    const w = await world();
    const res = await sentry(sentryReq(w.ws.login, sentryBody(), hmac("sentry-secret", sentryBody())));
    expect(res.status).toBe(200);
    const [inc] = await w.incidents();
    expect(inc).toMatchObject({ source: "sentry", status: "awaiting_fix", repoId: w.repo.id, fingerprint: "sentry-4512", title: "IntegrityError: duplicate key value" });
    expect((await w.deliveries("sentry"))[0].ok).toBe(true);
  });
  test("a bad or missing signature is rejected and stores nothing but the rejection", async () => {
    const w = await world();
    expect((await sentry(sentryReq(w.ws.login, sentryBody(), hmac("wrong", sentryBody())))).status).toBe(401);
    expect((await sentry(sentryReq(w.ws.login, sentryBody(), null))).status).toBe(401);
    expect(await w.incidents()).toEqual([]);
    expect((await w.deliveries("sentry")).every((d) => !d.ok)).toBe(true);
  });
  test("the same Sentry issue twice does not open a second incident", async () => {
    const w = await world();
    await sentry(sentryReq(w.ws.login, sentryBody(), hmac("sentry-secret", sentryBody())));
    await sentry(sentryReq(w.ws.login, sentryBody(), hmac("sentry-secret", sentryBody())));
    expect(await w.incidents()).toHaveLength(1);
  });
  test("an unknown workspace is a 404", async () => {
    expect((await sentry(sentryReq("nope-nope", sentryBody(), hmac("sentry-secret", sentryBody())))).status).toBe(404);
  });
});

describe("PagerDuty", () => {
  test("a signed resolved incident opens an incident awaiting its fix", async () => {
    const w = await world();
    const req = new NextRequest(`http://localhost/api/webhooks/pagerduty?workspace=${w.ws.login}`, { method: "POST", body: pdBody, headers: { "x-pagerduty-signature": `v1=${hmac("other", pdBody)},v1=${hmac("pd-secret", pdBody)}` } });
    expect((await pagerduty(req)).status).toBe(200);
    const [inc] = await w.incidents();
    expect(inc).toMatchObject({ source: "pagerduty", status: "awaiting_fix", fingerprint: "pd-P8K2QX", repoId: w.repo.id });
  });
  test("a bad signature is rejected", async () => {
    const w = await world();
    const req = new NextRequest(`http://localhost/api/webhooks/pagerduty?workspace=${w.ws.login}`, { method: "POST", body: pdBody, headers: { "x-pagerduty-signature": `v1=${hmac("nope", pdBody)}` } });
    expect((await pagerduty(req)).status).toBe(401);
    expect(await w.incidents()).toEqual([]);
  });
});

describe("intake registry", async () => {
  const { POST: dynamic } = await import("@/app/api/webhooks/[source]/route");
  const { signStandardWebhook } = await import("@/lib/integrations/signatures");
  const secret = "whsec_" + Buffer.from("incident-io-secret-for-tests").toString("base64");
  const call = (source: string, login: string, body: string, headers: Record<string, string>) =>
    dynamic(new NextRequest(`http://localhost/api/webhooks/${source}?workspace=${login}`, { method: "POST", body, headers }), { params: Promise.resolve({ source }) });
  const incBody = JSON.stringify({ event_type: "public_incident.incident_created_v2", "public_incident.incident_created_v2": { id: "01HX", name: "Checkout totals overflow", summary: "500 on /checkout", permalink: "https://app.incident.io/x", incident_type: { name: "checkout" } } });
  const signed = (body: string, ts = Math.floor(Date.now() / 1000)) => ({ "webhook-id": "msg_1", "webhook-timestamp": String(ts), "webhook-signature": signStandardWebhook("msg_1", String(ts), body, secret) });

  async function labsWorld(flag: boolean) {
    const w = await world();
    const db = await getDb();
    await db.update(s.workspaces).set({ settings: { flags: { intakeExtra: flag } } }).where(eq(s.workspaces.id, w.ws.id));
    await db.insert(s.integrations).values([
      { workspaceId: w.ws.id, kind: "incidentio", config: { types: "checkout:ecommerce-api" }, secretCiphertext: encrypt(secret) },
      { workspaceId: w.ws.id, kind: "datadog", config: {}, secretCiphertext: encrypt("dd-token") },
    ]);
    return w;
  }

  test("a signed incident.io incident opens an incident once the Labs flag is on", async () => {
    const w = await labsWorld(true);
    expect((await call("incidentio", w.ws.login, incBody, signed(incBody))).status).toBe(200);
    expect((await call("incidentio", w.ws.login, incBody, signed(incBody))).status).toBe(200);
    const incs = await w.incidents();
    expect(incs).toHaveLength(1);
    expect(incs[0]).toMatchObject({ source: "incidentio", fingerprint: "incidentio-01HX", repoId: w.repo.id, status: "awaiting_fix" });
    expect(incs[0].statusReason).toContain("incident.io");
  });
  test("with the flag off, new sources answer 404 and store nothing", async () => {
    const w = await labsWorld(false);
    expect((await call("incidentio", w.ws.login, incBody, signed(incBody))).status).toBe(404);
    expect(await w.incidents()).toEqual([]);
    expect(await w.deliveries("incidentio")).toEqual([]);
  });
  test("a replayed delivery outside the five-minute window is rejected", async () => {
    const w = await labsWorld(true);
    expect((await call("incidentio", w.ws.login, incBody, signed(incBody, Math.floor(Date.now() / 1000) - 600))).status).toBe(401);
    expect(await w.incidents()).toEqual([]);
  });
  test("bodies over 256 KiB are refused before verification", async () => {
    const w = await labsWorld(true);
    const big = JSON.stringify({ pad: "x".repeat(300_000) });
    expect((await call("incidentio", w.ws.login, big, signed(big))).status).toBe(413);
  });
  test("a correctly signed body that is not JSON is a 400", async () => {
    const w = await labsWorld(true);
    expect((await call("incidentio", w.ws.login, "not json", signed("not json"))).status).toBe(400);
  });
  test("Datadog authenticates with the workspace token", async () => {
    const w = await labsWorld(true);
    const body = JSON.stringify({ id: "agg-9", title: "[Triggered] checkout p99", message: "p99 > 2s", transition: "Triggered", tags: "service:ecommerce-api" });
    expect((await call("datadog", w.ws.login, body, { authorization: "Bearer wrong" })).status).toBe(401);
    expect((await call("datadog", w.ws.login, body, { authorization: "Bearer dd-token" })).status).toBe(200);
    expect((await w.incidents())[0]).toMatchObject({ source: "datadog", fingerprint: "datadog-agg-9", repoId: w.repo.id });
  });
  test("an unknown source is a 404", async () => {
    const w = await labsWorld(true);
    expect((await call("myspace", w.ws.login, "{}", {})).status).toBe(404);
  });
});

describe("recurrence detection", () => {
  test("a new alert that looks like a past incident is linked to it", async () => {
    const w = await world();
    const db = await getDb();
    const [past] = await db.insert(s.incidents).values({ workspaceId: w.ws.id, repoId: w.repo.id, number: 1, title: "IntegrityError in create_order", observed: "duplicate key value violates unique constraint orders_cart_id_key", source: "form", status: "proven", watchedFiles: ["app/services/order_service.py"] }).returning();
    const body = JSON.stringify({ action: "created", data: { issue: { id: "9001", title: "IntegrityError: duplicate key value violates unique constraint", culprit: "app/services/order_service.py in create_order", project: { slug: "shop-backend" } } } });
    expect((await sentry(sentryReq(w.ws.login, body, hmac("sentry-secret", body)))).status).toBe(200);
    const fresh = (await w.incidents()).find((i) => i.fingerprint === "sentry-9001")!;
    expect(fresh.related[0]).toMatchObject({ id: past.id, key: "INC-1" });
    const acts = await db.select().from(s.activity).where(eq(s.activity.incidentId, fresh.id));
    expect(acts.map((a) => a.title)).toContain(`INC-${fresh.number} looks like INC-1 again`);
  });
});
