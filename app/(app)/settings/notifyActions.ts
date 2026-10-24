"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { authorize } from "@/lib/auth/scope";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { flagEnabled } from "@/lib/flags";
import { audit } from "@/lib/data/lifecycle";
import { checkTargetUrl } from "@/lib/net/safeFetch";
import { newStandardSecret } from "@/lib/integrations/signatures";
import { NOTIFY_EVENT_IDS } from "@/lib/notify/format";
import type { FormState } from "../actions";

const MAX_TARGETS = 10;

async function admin() {
  const ctx = await authorize("manageIntegrations");
  if (!ctx.allowed) return { error: "Only owners and admins can do this." } as const;
  if (!flagEnabled("notifications", (await ctx.scope.workspace())?.settings)) return { error: "Turn on Notifications in Settings → Labs first." } as const;
  return ctx;
}

const eventsFrom = (form: FormData) => NOTIFY_EVENT_IDS.filter((e) => form.getAll("events").includes(e));

/** "hooks.slack.com/…/abcd" or "ops.example.com/hooks/…": enough to recognise, not enough to use. */
function hintFor(url: string): string {
  const u = new URL(url);
  return u.hostname === "hooks.slack.com" ? `hooks.slack.com/…/${u.pathname.slice(-4)}` : `${u.hostname}${u.pathname.length > 24 ? `${u.pathname.slice(0, 20)}…` : u.pathname}`;
}

export async function addTarget(_p: FormState, form: FormData): Promise<FormState> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  const kind = form.get("kind") === "slack" ? "slack" : "webhook";
  const url = String(form.get("url") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 80) || (kind === "slack" ? "Slack" : "Webhook");
  const events = eventsFrom(form);
  const fields = { kind, name, url, events: events.join(",") };
  const bad = checkTargetUrl(url, kind);
  if (bad) return { error: bad, fields };
  if (!events.length) return { error: "Choose at least one event.", fields };
  const db = await getDb();
  const existing = await db.select({ id: s.notificationTargets.id }).from(s.notificationTargets).where(eq(s.notificationTargets.workspaceId, ctx.session.workspaceId));
  if (existing.length >= MAX_TARGETS) return { error: `A workspace can have up to ${MAX_TARGETS} targets.`, fields };
  const secret = kind === "webhook" ? newStandardSecret() : undefined;
  await db.insert(s.notificationTargets).values({ workspaceId: ctx.session.workspaceId, kind, name, urlCiphertext: encrypt(url), urlHint: hintFor(url), secretCiphertext: secret ? encrypt(secret) : null, events });
  await audit(ctx.session.workspaceId, ctx.session.userId, "notification.target_added", name, kind);
  revalidatePath("/settings");
  return secret ? { ok: "Added. Verify deliveries with this signing secret (Standard Webhooks). It will not be shown again.", token: secret } : { ok: "Added." };
}

export async function updateTarget(form: FormData): Promise<void> {
  const ctx = await admin();
  if ("error" in ctx) return;
  const id = String(form.get("targetId") ?? "");
  const op = String(form.get("op") ?? "");
  const db = await getDb();
  const where = and(eq(s.notificationTargets.id, id), eq(s.notificationTargets.workspaceId, ctx.session.workspaceId));
  if (op === "events") await db.update(s.notificationTargets).set({ events: eventsFrom(form) }).where(where);
  else if (op === "enable") await db.update(s.notificationTargets).set({ enabled: true, consecutiveFailures: 0, disabledReason: null }).where(where);
  else if (op === "disable") await db.update(s.notificationTargets).set({ enabled: false, disabledReason: "Switched off by an admin." }).where(where);
  else if (op === "remove") {
    const [gone] = await db.delete(s.notificationTargets).where(where).returning();
    if (gone) await audit(ctx.session.workspaceId, ctx.session.userId, "notification.target_removed", gone.name, gone.kind);
  }
  revalidatePath("/settings");
}

/** Sends one sample notification straight to the target (not through the outbox) and reports the HTTP status. */
export async function testTarget(_p: FormState, form: FormData): Promise<FormState> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  const db = await getDb();
  const [t] = await db.select().from(s.notificationTargets).where(and(eq(s.notificationTargets.id, String(form.get("targetId") ?? "")), eq(s.notificationTargets.workspaceId, ctx.session.workspaceId)));
  if (!t) return { error: "Target not found." };
  const ws = await ctx.scope.workspace();
  const { sendNotification } = await import("@/lib/notify/send");
  const row = { id: `ntf_test_${crypto.randomUUID().slice(0, 8)}`, payload: { event: "incident.proven", title: "Test notification from Aftershock", detail: "If you can read this, notifications reach this target.", tone: "pass", workspace: ws?.login ?? "", createdAt: new Date().toISOString(), url: `${(process.env.APP_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")}/settings?tab=notifications` } };
  try {
    const r = await sendNotification(t, row as never);
    return r.ok ? { ok: `Delivered (HTTP ${r.status}).` } : { error: `The target answered HTTP ${r.status}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delivery failed." };
  }
}
