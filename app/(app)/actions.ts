"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { currentScope } from "@/lib/auth/scope";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey } from "@/lib/domain/ids";
import { listImportableIssues } from "@/lib/github/issues";
import { encrypt, hashToken, newToken } from "@/lib/crypto";

export type FormState = { error?: string; ok?: string; fields?: Record<string, string>; token?: string };

const incidentSchema = z.object({
  title: z.string().trim().min(3, "Give the incident a title of at least 3 characters.").max(200),
  repoId: z.string().min(1, "Choose a repository."),
  severity: z.enum(["SEV-1", "SEV-2", "SEV-3"]),
  trigger: z.string().trim().max(4000),
  observed: z.string().trim().min(3, "Describe what the system did.").max(4000),
  expected: z.string().trim().min(3, "Describe what it should have done.").max(4000),
  fix: z.string().trim().max(300),
  intent: z.enum(["save", "travel"]),
});

/** Turns "aa86f56", "#44", "44" or a GitHub PR/commit URL into a fix reference. */
export async function parseFixRef(raw: string): Promise<{ sha?: string; pr?: number } | null> {
  const v = raw.trim();
  if (!v) return {};
  const pr = v.match(/(?:^#?|\/pull\/)(\d{1,7})$/);
  if (pr) return { pr: Number(pr[1]) };
  const sha = v.match(/(?:^|\/commit\/)([0-9a-f]{7,40})$/i);
  if (sha) return { sha: sha[1].toLowerCase() };
  return null;
}

async function insertIncident(workspaceId: string, values: Omit<typeof s.incidents.$inferInsert, "workspaceId" | "number">) {
  const db = await getDb();
  const { scoped } = await import("@/lib/db/queries/scope");
  for (let tries = 0; tries < 3; tries++) {
    const number = await scoped(workspaceId).nextIncidentNumber();
    try {
      const [row] = await db.insert(s.incidents).values({ ...values, workspaceId, number }).returning();
      return row;
    } catch (err) {
      if (tries === 2) throw err;
    }
  }
  throw new Error("unreachable");
}

export async function createIncident(_prev: FormState, form: FormData): Promise<FormState> {
  const { scope, session } = await currentScope();
  const parsed = incidentSchema.safeParse(Object.fromEntries(form));
  const fields = Object.fromEntries([...form].map(([k, v]) => [k, String(v)]));
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const d = parsed.data;
  if (!(await scope.repo(d.repoId))) return { error: "That repository is not in this workspace.", fields };
  const fix = await parseFixRef(d.fix);
  if (fix === null) return { error: "Enter the fix as a commit SHA, a PR number like #44, or a GitHub URL.", fields };
  const ws = await scope.workspace();
  const row = await insertIncident(session.workspaceId, {
    repoId: d.repoId, title: d.title, severity: d.severity, trigger: d.trigger, observed: d.observed, expected: d.expected, source: "form",
    fixSha: fix.sha ?? null, fixPr: fix.pr ?? null, status: "awaiting_fix",
    statusReason: fix.sha || fix.pr ? null : "No fix linked yet. Link the fix commit or PR to start time travel.",
  });
  const db = await getDb();
  await db.insert(s.activity).values({ workspaceId: session.workspaceId, incidentId: row.id, title: `${incidentKey(ws?.incidentPrefix ?? "INC", row.number)} recorded`, detail: "From the form", tone: "neutral" });
  if (d.intent === "travel" && (fix.sha || fix.pr)) {
    const { startTimeTravel } = await import("@/lib/workflows/start");
    await startTimeTravel(row.id);
    redirect(`/incidents/${row.number}/travel`);
  }
  revalidatePath("/incidents");
  redirect(`/incidents/${row.number}`);
}

export async function importIssue(form: FormData): Promise<void> {
  const { scope, session } = await currentScope();
  const key = String(form.get("issue") ?? "");
  const issue = (await listImportableIssues(scope)).find((i) => `${i.repoId}:${i.number}` === key);
  if (!issue) redirect("/incidents/new?tab=issue&error=issue_missing");
  const ws = await scope.workspace();
  const hasFix = Boolean(issue.fixSha || issue.fixPr);
  const row = await insertIncident(session.workspaceId, {
    repoId: issue.repoId, title: issue.title, observed: issue.body, source: "issue", sourceRef: `${issue.repo}#${issue.number}`,
    fixSha: issue.fixSha ?? null, parentSha: issue.parentSha ?? null, fixPr: issue.fixPr ?? null, status: "awaiting_fix",
    statusReason: hasFix ? null : "The issue was closed without a linked fix. Link the fix commit or PR to start time travel.",
  });
  const db = await getDb();
  await db.insert(s.activity).values({ workspaceId: session.workspaceId, incidentId: row.id, title: `Imported from issue #${issue.number}`, detail: `${incidentKey(ws?.incidentPrefix ?? "INC", row.number)} · ${issue.repo}`, tone: "pass" });
  if (hasFix && form.get("intent") === "travel") {
    const { startTimeTravel } = await import("@/lib/workflows/start");
    await startTimeTravel(row.id);
    redirect(`/incidents/${row.number}/travel`);
  }
  redirect(`/incidents/${row.number}`);
}

export async function extractPostmortem(_prev: FormState, form: FormData): Promise<FormState> {
  await currentScope();
  const text = String(form.get("postmortem") ?? "").trim();
  if (text.length < 40) return { error: "Paste the postmortem text — at least a few sentences.", fields: { postmortem: text } };
  try {
    const { extractIncident } = await import("@/lib/model/extract");
    const fields = await extractIncident(text);
    return { ok: "Extracted — check before saving", fields: { ...fields, postmortem: text } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The model could not extract this postmortem.", fields: { postmortem: text } };
  }
}

export async function linkFix(form: FormData): Promise<void> {
  const { scope, session } = await currentScope();
  const inc = await scope.getIncidentById(String(form.get("incidentId")));
  if (!inc) redirect("/incidents");
  const fix = await parseFixRef(String(form.get("fix") ?? ""));
  if (!fix || (!fix.sha && !fix.pr)) redirect(`/incidents/${inc.number}?error=fix`);
  const db = await getDb();
  await db.update(s.incidents).set({ fixSha: fix.sha ?? null, fixPr: fix.pr ?? null, parentSha: null, statusReason: null, updatedAt: new Date() }).where(and(eq(s.incidents.id, inc.id), eq(s.incidents.workspaceId, session.workspaceId)));
  await db.insert(s.activity).values({ workspaceId: session.workspaceId, incidentId: inc.id, title: "Fix linked", detail: fix.sha ? fix.sha : `PR #${fix.pr}`, tone: "pass" });
  const { startTimeTravel } = await import("@/lib/workflows/start");
  await startTimeTravel(inc.id);
  redirect(`/incidents/${inc.number}/travel`);
}

export async function retryTimeTravel(form: FormData): Promise<void> {
  const { scope } = await currentScope();
  const inc = await scope.getIncidentById(String(form.get("incidentId")));
  if (!inc) redirect("/incidents");
  const hint = String(form.get("hint") ?? "").trim().slice(0, 2000);
  const { startTimeTravel } = await import("@/lib/workflows/start");
  await startTimeTravel(inc.id, { hint: hint || undefined });
  redirect(`/incidents/${inc.number}/travel`);
}

export async function addNote(form: FormData): Promise<void> {
  const { scope, session } = await currentScope();
  const inc = await scope.getIncidentById(String(form.get("incidentId")));
  const text = String(form.get("text") ?? "").trim();
  if (!inc) redirect("/incidents");
  if (text) {
    const db = await getDb();
    await db.insert(s.notes).values({ incidentId: inc.id, userId: session.userId, text: text.slice(0, 4000) });
  }
  revalidatePath(`/incidents/${inc.number}`);
}

export async function setRepoSetting(form: FormData): Promise<void> {
  const { scope, session } = await currentScope();
  const repo = await scope.repo(String(form.get("repoId")));
  if (!repo) return;
  const field = String(form.get("field"));
  const value = String(form.get("value"));
  const db = await getDb();
  const where = and(eq(s.repositories.id, repo.id), eq(s.repositories.workspaceId, session.workspaceId));
  if (field === "runner" && (value === "sandbox" || value === "actions")) await db.update(s.repositories).set({ runner: value }).where(where);
  if (field === "checkMode" && (value === "blocking" || value === "advisory")) await db.update(s.repositories).set({ checkMode: value }).where(where);
  if (field === "installCmd" && value.trim()) await db.update(s.repositories).set({ installCmd: value.trim().slice(0, 300) }).where(where);
  revalidatePath("/repositories");
}

export async function overrideCheck(_prev: FormState, form: FormData): Promise<FormState> {
  const { session } = await currentScope();
  const reason = String(form.get("reason") ?? "").trim();
  if (reason.length < 10) return { error: "Give a reason of at least 10 characters. It is recorded on the incident trail." };
  const db = await getDb();
  const [check] = await db.select().from(s.prChecks).where(and(eq(s.prChecks.id, String(form.get("checkId"))), eq(s.prChecks.workspaceId, session.workspaceId)));
  if (!check) return { error: "Check not found." };
  await db.insert(s.overrides).values({ checkId: check.id, userId: session.userId, reason: reason.slice(0, 2000) });
  await db.update(s.prChecks).set({ overridden: true }).where(eq(s.prChecks.id, check.id));
  await db.insert(s.activity).values({ workspaceId: session.workspaceId, title: `PR #${check.prNumber} check overridden`, detail: reason.slice(0, 200), tone: "neutral" });
  revalidatePath(`/pulls/${check.prNumber}`);
  return { ok: "Override recorded." };
}

export async function requestSuggestedFix(form: FormData): Promise<void> {
  const { session } = await currentScope();
  const db = await getDb();
  const [check] = await db.select().from(s.prChecks).where(and(eq(s.prChecks.id, String(form.get("checkId"))), eq(s.prChecks.workspaceId, session.workspaceId)));
  if (!check) return;
  const { startSuggestFix } = await import("@/lib/workflows/start");
  await startSuggestFix(check.id);
  revalidatePath(`/pulls/${check.prNumber}`);
}

export async function saveWorkspace(_prev: FormState, form: FormData): Promise<FormState> {
  const { session } = await currentScope();
  const name = String(form.get("name") ?? "").trim();
  const prefix = String(form.get("prefix") ?? "").trim().toUpperCase();
  if (name.length < 2) return { error: "Name must be at least 2 characters." };
  if (!/^[A-Z]{2,6}$/.test(prefix)) return { error: "Prefix must be 2–6 letters." };
  const db = await getDb();
  await db
    .update(s.workspaces)
    .set({ name, incidentPrefix: prefix, settings: { autoImportIssues: form.get("autoImport") === "on", autoTravelOnMerge: form.get("autoTravel") === "on", issueLabel: String(form.get("label") || "incident").slice(0, 50) } })
    .where(eq(s.workspaces.id, session.workspaceId));
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function createToken(_prev: FormState, form: FormData): Promise<FormState> {
  const { session } = await currentScope();
  const name = String(form.get("name") ?? "").trim() || "API token";
  const token = newToken();
  const db = await getDb();
  await db.insert(s.apiTokens).values({ workspaceId: session.workspaceId, name: name.slice(0, 100), prefix: `as_live_••••${token.slice(-4)}`, hash: hashToken(token) });
  revalidatePath("/settings");
  return { ok: "Copy this token now. It will not be shown again.", token };
}

export async function revokeToken(form: FormData): Promise<void> {
  const { session } = await currentScope();
  const db = await getDb();
  await db.delete(s.apiTokens).where(and(eq(s.apiTokens.id, String(form.get("tokenId"))), eq(s.apiTokens.workspaceId, session.workspaceId)));
  revalidatePath("/settings");
}

export async function finishOnboarding(form: FormData): Promise<void> {
  const { scope, session } = await currentScope();
  const runner = form.get("runner") === "actions" ? "actions" : "sandbox";
  const provider = ["muse", "gateway", "custom"].includes(String(form.get("provider"))) ? String(form.get("provider")) : "muse";
  const chosen = new Set(form.getAll("repo").map(String));
  const db = await getDb();
  for (const r of await scope.repos()) {
    if (chosen.has(r.id)) await db.update(s.repositories).set({ runner }).where(and(eq(s.repositories.id, r.id), eq(s.repositories.workspaceId, session.workspaceId)));
  }
  const config: Record<string, string> = { provider, model: String(form.get("model") || (provider === "muse" ? "muse-spark-1.3-contributor" : "")) };
  if (provider === "custom") config.baseUrl = String(form.get("baseUrl") ?? "");
  const key = String(form.get("apiKey") ?? "").trim();
  await db
    .insert(s.integrations)
    .values({ workspaceId: session.workspaceId, kind: "model", config, secretCiphertext: key ? encrypt(key) : null })
    .onConflictDoUpdate({ target: [s.integrations.workspaceId, s.integrations.kind], set: { config, ...(key ? { secretCiphertext: encrypt(key) } : {}) } });
  redirect("/incidents/new?tab=issue");
}
