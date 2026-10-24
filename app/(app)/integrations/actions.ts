"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { authorize, currentScope } from "@/lib/auth/scope";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import type { FormState } from "../actions";
import type { IntakeKind } from "@/lib/db/schema";
import { flagEnabled } from "@/lib/flags";
import { audit } from "@/lib/data/lifecycle";
import { receive } from "@/lib/integrations/receive";
import { isSource, SOURCES, type SourceDef } from "@/lib/integrations/sources";

type Scope = Awaited<ReturnType<typeof authorize>>["scope"];

/** The source named in the form, if it exists and (for Labs sources) is switched on for this workspace. */
async function sourceFrom(form: FormData, scope: Scope): Promise<SourceDef | null> {
  const id = String(form.get("kind") ?? "");
  if (!isSource(id)) return null;
  const def = SOURCES[id];
  if (def.labs && !flagEnabled("intakeExtra", (await scope.workspace())?.settings)) return null;
  return def;
}

async function upsert(workspaceId: string, kind: IntakeKind | "model", config: Record<string, string>, secret?: string) {
  const db = await getDb();
  const [existing] = await db.select().from(s.integrations).where(and(eq(s.integrations.workspaceId, workspaceId), eq(s.integrations.kind, kind)));
  const merged = { ...(existing?.config ?? {}), ...config };
  await db
    .insert(s.integrations)
    .values({ workspaceId, kind, config: merged, enabled: true, secretCiphertext: secret ? encrypt(secret) : null })
    .onConflictDoUpdate({ target: [s.integrations.workspaceId, s.integrations.kind], set: { config: merged, enabled: true, ...(secret ? { secretCiphertext: encrypt(secret) } : {}) } });
}

export async function saveMapping(_p: FormState, form: FormData): Promise<FormState> {
  const { scope, session, allowed } = await authorize("manageIntegrations");
  if (!allowed) return { error: "Only owners and admins can do this." };
  const def = await sourceFrom(form, scope);
  if (!def) return { error: "Unknown integration." };
  const value = String(form.get("mapping") ?? "").trim().slice(0, 1000);
  await upsert(session.workspaceId, def.id, { [def.mapping.key]: value, ...(def.id === "sentry" ? { rule: value ? `projects: ${value}` : "all projects" } : {}) });
  revalidatePath("/integrations");
  return { ok: "Saved." };
}

/** For sources where Aftershock creates the secret or token: generate one and show it once. */
export async function rotateSecret(_p: FormState, form: FormData): Promise<FormState> {
  const { scope, session, allowed } = await authorize("manageIntegrations");
  if (!allowed) return { error: "Only owners and admins can do this." };
  const def = await sourceFrom(form, scope);
  if (!def) return { error: "Unknown integration." };
  if (def.secretFrom === "provider") return { error: `${def.label} creates the signing secret. Paste it instead.` };
  const secret = def.newSecret();
  await upsert(session.workspaceId, def.id, { secretHint: secret.slice(-4) }, secret);
  await audit(session.workspaceId, session.userId, "integration.secret_rotated", def.id);
  revalidatePath("/integrations");
  return { ok: `Paste this ${def.auth === "token" ? "token" : "signing secret"} into ${def.label} now. It will not be shown again.`, token: secret };
}

/** For sources that create their own signing secret (Sentry, PagerDuty, incident.io, Linear): store the pasted value. */
export async function saveSecret(_p: FormState, form: FormData): Promise<FormState> {
  const { scope, session, allowed } = await authorize("manageIntegrations");
  if (!allowed) return { error: "Only owners and admins can do this." };
  const def = await sourceFrom(form, scope);
  if (!def) return { error: "Unknown integration." };
  const secret = String(form.get("secret") ?? "").trim();
  if (secret.length < 8 || secret.length > 500 || /\s/.test(secret)) return { error: "Paste the whole signing secret (no spaces)." };
  if (def.id === "incidentio" && !/^(whsec_)?[A-Za-z0-9+/]+={0,2}$/.test(secret)) return { error: "incident.io secrets look like whsec_…" };
  await upsert(session.workspaceId, def.id, { secretHint: secret.slice(-4) }, secret);
  await audit(session.workspaceId, session.userId, "integration.secret_saved", def.id);
  revalidatePath("/integrations");
  return { ok: "Signing secret saved. Send a test delivery to check it." };
}

/** Signs a harmless ping with the stored secret and sends it through the real intake path. */
export async function testDelivery(_p: FormState, form: FormData): Promise<FormState> {
  const { scope, session, allowed } = await authorize("manageIntegrations");
  if (!allowed) return { error: "Only owners and admins can do this." };
  const def = await sourceFrom(form, scope);
  if (!def) return { error: "Unknown integration." };
  const ws = await scope.workspace();
  const db = await getDb();
  const [integ] = await db.select().from(s.integrations).where(and(eq(s.integrations.workspaceId, session.workspaceId), eq(s.integrations.kind, def.id)));
  if (!integ?.secretCiphertext || !ws) return { error: def.secretFrom === "provider" ? "Save the signing secret first." : "Generate a secret first." };
  const { body, headers } = def.testRequest(decrypt(integ.secretCiphertext), Date.now());
  const req = new NextRequest(`http://internal/api/webhooks/${def.id}?workspace=${encodeURIComponent(ws.login)}`, { method: "POST", body, headers });
  const res = await receive(def.id, req);
  revalidatePath("/integrations");
  return res.ok ? { ok: `Test delivery accepted: the ${def.auth === "token" ? "token" : "signature"} verified.` } : { error: `Test delivery failed (${res.status}).` };
}

export async function saveModel(_p: FormState, form: FormData): Promise<FormState> {
  const { session, allowed } = await authorize("manageIntegrations");
  if (!allowed) return { error: "Only owners and admins can do this." };
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
