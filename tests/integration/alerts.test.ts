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
