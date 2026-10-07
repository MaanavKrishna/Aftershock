"use server";
import { randomBytes, createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { currentScope } from "@/lib/auth/scope";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import type { FormState } from "../actions";

type Kind = "sentry" | "pagerduty";

async function upsert(workspaceId: string, kind: "sentry" | "pagerduty" | "model", config: Record<string, string>, secret?: string) {
  const db = await getDb();
  const [existing] = await db.select().from(s.integrations).where(and(eq(s.integrations.workspaceId, workspaceId), eq(s.integrations.kind, kind)));
  const merged = { ...(existing?.config ?? {}), ...config };
  await db
    .insert(s.integrations)
    .values({ workspaceId, kind, config: merged, enabled: true, secretCiphertext: secret ? encrypt(secret) : null })
    .onConflictDoUpdate({ target: [s.integrations.workspaceId, s.integrations.kind], set: { config: merged, enabled: true, ...(secret ? { secretCiphertext: encrypt(secret) } : {}) } });
}

export async function saveMapping(_p: FormState, form: FormData): Promise<FormState> {
  const { session } = await currentScope();
  const kind = form.get("kind") as Kind;
  if (kind !== "sentry" && kind !== "pagerduty") return { error: "Unknown integration." };
  const value = String(form.get("mapping") ?? "").trim().slice(0, 1000);
  await upsert(session.workspaceId, kind, kind === "sentry" ? { projects: value, rule: value ? `projects: ${value}` : "all projects" } : { services: value });
  revalidatePath("/integrations");
  return { ok: "Saved." };
}

export async function rotateSecret(_p: FormState, form: FormData): Promise<FormState> {
  const { session } = await currentScope();
  const kind = form.get("kind") as Kind;
  if (kind !== "sentry" && kind !== "pagerduty") return { error: "Unknown integration." };
  const secret = randomBytes(24).toString("hex");
  await upsert(session.workspaceId, kind, { secretHint: secret.slice(-4) }, secret);
  revalidatePath("/integrations");
  return { ok: `Paste this signing secret into ${kind === "sentry" ? "Sentry" : "PagerDuty"} now. It will not be shown again.`, token: secret };
}

/** Signs a harmless ping with the stored secret and sends it through the real webhook route. */
export async function testDelivery(_p: FormState, form: FormData): Promise<FormState> {
  const { scope, session } = await currentScope();
  const kind = form.get("kind") as Kind;
  const ws = await scope.workspace();
  const db = await getDb();
  const [integ] = await db.select().from(s.integrations).where(and(eq(s.integrations.workspaceId, session.workspaceId), eq(s.integrations.kind, kind)));
  if (!integ?.secretCiphertext || !ws) return { error: "Generate a signing secret first." };
  const secret = decrypt(integ.secretCiphertext);
  const body = kind === "sentry" ? JSON.stringify({ action: "test", data: {} }) : JSON.stringify({ event: { event_type: "pagey.ping", data: {} } });
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  const url = `http://internal/api/webhooks/${kind}?workspace=${encodeURIComponent(ws.login)}`;
  const req = new NextRequest(url, { method: "POST", body, headers: kind === "sentry" ? { "sentry-hook-signature": sig } : { "x-pagerduty-signature": `v1=${sig}` } });
  const route = kind === "sentry" ? await import("@/app/api/webhooks/sentry/route") : await import("@/app/api/webhooks/pagerduty/route");
  const res = await route.POST(req);
  revalidatePath("/integrations");
  return res.ok ? { ok: "Test delivery accepted: the signature verified." } : { error: `Test delivery failed (${res.status}).` };
}

export async function saveModel(_p: FormState, form: FormData): Promise<FormState> {
  const { session } = await currentScope();
  const provider = String(form.get("provider"));
  if (!["muse", "gateway", "custom"].includes(provider)) return { error: "Choose a provider." };
  const model = String(form.get("model") ?? "").trim();
  const baseUrl = String(form.get("baseUrl") ?? "").trim();
  if (provider !== "muse" && !model) return { error: "Enter a model name." };
  const { isPublicHttpsUrl } = await import("@/lib/model/provider");
  if (provider === "custom" && !isPublicHttpsUrl(baseUrl)) return { error: "The base URL must be a public https:// address (no localhost or private networks)." };
  const key = String(form.get("apiKey") ?? "").trim();
  await upsert(session.workspaceId, "model", { provider, model, ...(provider === "custom" ? { baseUrl } : {}) }, key || undefined);
  revalidatePath("/integrations");
  return { ok: "Saved. Use “Test connection” to check it." };
}

export async function testModel(): Promise<FormState> {
  const { session } = await currentScope();
  try {
    const { complete } = await import("@/lib/model/provider");
    const t0 = Date.now();
    const res = await complete(session.workspaceId, [{ role: "user", content: 'Reply with exactly {"ok": true}' }]);
    await (await getDb()).insert(s.deliveries).values({ workspaceId: session.workspaceId, kind: "model", event: "connection test", detail: `${((Date.now() - t0) / 1000).toFixed(1)}s · ${res.model}`, ok: true });
    revalidatePath("/integrations");
    return { ok: `Connected to ${res.model}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The model did not respond." };
  }
}
