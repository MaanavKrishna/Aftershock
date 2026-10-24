"use server";
import { fieldsFromIssue } from "@/lib/domain/issueBody";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authorize, currentScope } from "@/lib/auth/scope";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { recordActivity } from "@/lib/notify/outbox";
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
  source: z.enum(["form", "postmortem"]).default("form"),
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

const insertIncident = async (...a: Parameters<typeof import("@/lib/incidents/create").insertIncident>) => (await import("@/lib/incidents/create")).insertIncident(...a);

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
    repoId: d.repoId, title: d.title, severity: d.severity, trigger: d.trigger, observed: d.observed, expected: d.expected, source: d.source,
    fixSha: fix.sha ?? null, fixPr: fix.pr ?? null, status: "awaiting_fix",
    statusReason: fix.sha || fix.pr ? null : "No fix linked yet. Link the fix commit or PR to start time travel.",
  });
  const db = await getDb();
  await recordActivity({ workspaceId: session.workspaceId, incidentId: row.id, title: `${incidentKey(ws?.incidentPrefix ?? "INC", row.number)} recorded`, detail: d.source === "postmortem" ? "From a postmortem" : "From the form", tone: "neutral", event: "incident.opened" });
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
  const { importIssueAsIncident } = await import("@/lib/incidents/create");
  const { row, hasFix } = await importIssueAsIncident(session.workspaceId, ws?.incidentPrefix ?? "INC", issue);
  if (hasFix && form.get("intent") === "travel") {
    const { startTimeTravel } = await import("@/lib/workflows/start");
    await startTimeTravel(row.id);
    redirect(`/incidents/${row.number}/travel`);
  }
  redirect(`/incidents/${row.number}`);
}

export async function extractPostmortem(_prev: FormState, form: FormData): Promise<FormState> {
  const { scope, session } = await currentScope();
  const text = String(form.get("postmortem") ?? "").trim();
  if (text.length < 40) return { error: "Paste the postmortem text — at least a few sentences.", fields: { postmortem: text } };
  try {
    const { extractIncident } = await import("@/lib/model/extract");
    const fields = await extractIncident(text, session.workspaceId);
    const { guessRepoId } = await import("@/lib/domain/guessRepo");
    const repoId = guessRepoId(text, await scope.repos());
    return { ok: "Extracted — check before saving", fields: { ...fields, ...(repoId ? { repoId } : {}), source: "postmortem", postmortem: text } };
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
  await recordActivity({ workspaceId: session.workspaceId, incidentId: inc.id, title: "Fix linked", detail: fix.sha ? fix.sha : `PR #${fix.pr}`, tone: "pass" });
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

/** Runs Epicenter again for a proven incident, e.g. after more history arrives. */
export async function searchEpicenter(form: FormData): Promise<void> {
  const { scope } = await currentScope();
  const inc = await scope.getIncidentById(String(form.get("incidentId")));
  if (!inc) redirect("/incidents");
  const mem = await scope.memoryForIncident(inc.id);
  if (mem) {
    const db = await getDb();
    await db.update(s.incidents).set({ epicenter: null }).where(and(eq(s.incidents.id, inc.id), eq(s.incidents.workspaceId, inc.workspaceId)));
    const { startEpicenter } = await import("@/lib/workflows/start");
    await startEpicenter(mem.id);
  }
  revalidatePath(`/incidents/${inc.number}`);
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
  const { scope, session, allowed } = await authorize("manageRepositories");
  if (!allowed) return;
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
  const { session, allowed } = await authorize("override");
  if (!allowed) return { error: "Only owners and admins can do this." };
  const reason = String(form.get("reason") ?? "").trim();
  if (reason.length < 10) return { error: "Give a reason of at least 10 characters. It is recorded on the incident trail." };
  const db = await getDb();
  const [check] = await db.select().from(s.prChecks).where(and(eq(s.prChecks.id, String(form.get("checkId"))), eq(s.prChecks.workspaceId, session.workspaceId)));
  if (!check) return { error: "Check not found." };
  await db.insert(s.overrides).values({ checkId: check.id, userId: session.userId, reason: reason.slice(0, 2000) });
  await db.update(s.prChecks).set({ overridden: true }).where(eq(s.prChecks.id, check.id));
  await recordActivity({ workspaceId: session.workspaceId, title: `PR #${check.prNumber} check overridden`, detail: reason.slice(0, 200), tone: "neutral", event: "check.overridden" });
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
  const { session, allowed } = await authorize("manageWorkspace");
  if (!allowed) return { error: "Only owners and admins can do this." };
  const name = String(form.get("name") ?? "").trim();
  const prefix = String(form.get("prefix") ?? "").trim().toUpperCase();
  if (name.length < 2) return { error: "Name must be at least 2 characters." };
  if (!/^[A-Z]{2,6}$/.test(prefix)) return { error: "Prefix must be 2–6 letters." };
  const db = await getDb();
  const [current] = await db.select({ settings: s.workspaces.settings }).from(s.workspaces).where(eq(s.workspaces.id, session.workspaceId));
  await db
    .update(s.workspaces)
    // Merge: other settings (feature flags) must survive saving this form.
    .set({ name, incidentPrefix: prefix, settings: { ...current?.settings, autoImportIssues: form.get("autoImport") === "on", autoTravelOnMerge: form.get("autoTravel") === "on", issueLabel: String(form.get("label") || "incident").slice(0, 50) } })
    .where(eq(s.workspaces.id, session.workspaceId));
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function createToken(_prev: FormState, form: FormData): Promise<FormState> {
  const { session, allowed } = await authorize("manageTokens");
  if (!allowed) return { error: "Only owners and admins can do this." };
  const name = String(form.get("name") ?? "").trim() || "API token";
  const scope = form.get("scope") === "read" ? "read" : "write";
  const token = newToken();
  const db = await getDb();
  await db.insert(s.apiTokens).values({ workspaceId: session.workspaceId, name: name.slice(0, 100), prefix: `as_live_••••${token.slice(-4)}`, hash: hashToken(token), scope });
  const { audit } = await import("@/lib/data/lifecycle");
  await audit(session.workspaceId, session.userId, "token.created", name.slice(0, 100), scope);
  revalidatePath("/settings");
  return { ok: "Copy this token now. It will not be shown again.", token };
}

export async function revokeToken(form: FormData): Promise<void> {
  const { session, allowed } = await authorize("manageTokens");
  if (!allowed) return;
  const db = await getDb();
  await db.delete(s.apiTokens).where(and(eq(s.apiTokens.id, String(form.get("tokenId"))), eq(s.apiTokens.workspaceId, session.workspaceId)));
  revalidatePath("/settings");
}

export async function finishOnboarding(form: FormData): Promise<void> {
  const { scope, session, allowed } = await authorize("manageRepositories");
  if (!allowed) redirect("/overview");
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

/** Turns a Labs feature on or off for this workspace (owners and admins). */
export async function setFlag(form: FormData): Promise<void> {
  const { session, allowed } = await authorize("manageWorkspace");
  if (!allowed) return;
  const { FLAGS } = await import("@/lib/flags");
  const flag = String(form.get("flag") ?? "");
  if (!(flag in FLAGS)) return;
  const on = form.get("on") === "1";
  const db = await getDb();
  const [current] = await db.select({ settings: s.workspaces.settings }).from(s.workspaces).where(eq(s.workspaces.id, session.workspaceId));
  await db
    .update(s.workspaces)
    .set({ settings: { ...current?.settings, flags: { ...current?.settings.flags, [flag]: on } } })
    .where(eq(s.workspaces.id, session.workspaceId));
  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------------------------
// Deleting data and managing members. Every destructive action needs a typed confirmation and
// is written to the audit log.
// ---------------------------------------------------------------------------------------------

async function snapshotDeleter() {
  const { dbCacheStore } = await import("@/lib/runner/cacheStore");
  const store = dbCacheStore();
  return (id: string) => store.deleteSnapshot(id);
}

const confirmed = (form: FormData, expected: string) => String(form.get("confirm") ?? "").trim() === expected;

export async function deleteIncidentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { session, scope, allowed } = await authorize("manageWorkspace");
  if (!allowed) return { error: "Only owners and admins can delete incidents." };
  const inc = await scope.getIncidentById(String(form.get("incidentId")));
  if (!inc) return { error: "That incident no longer exists." };
  const ws = await scope.workspace();
  const key = incidentKey(ws?.incidentPrefix ?? "INC", inc.number);
  if (!confirmed(form, key)) return { error: `The confirmation did not match. Type ${key} exactly.` };
  const { deleteIncident } = await import("@/lib/data/lifecycle");
  await deleteIncident(session.workspaceId, inc.number, session.userId);
  revalidatePath("/", "layout");
  redirect("/incidents");
}

export async function deleteRepositoryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { session, scope, allowed } = await authorize("manageRepositories");
  if (!allowed) return { error: "Only owners and admins can remove repositories." };
  const repo = await scope.repo(String(form.get("repoId")));
  if (!repo) return { error: "That repository is not in this workspace." };
  if (!confirmed(form, repo.name)) return { error: `The confirmation did not match. Type ${repo.name} exactly.` };
  const { deleteRepository } = await import("@/lib/data/lifecycle");
  await deleteRepository(session.workspaceId, repo.id, session.userId, "removed in Aftershock", await snapshotDeleter());
  revalidatePath("/", "layout");
  return { ok: `${repo.name} was removed. Remove it from the GitHub App too, or it will be added again.` };
}

async function signOut() {
  const { cookies } = await import("next/headers");
  const { SESSION_COOKIE } = await import("@/lib/auth/token");
  (await cookies()).delete(SESSION_COOKIE);
}

export async function deleteWorkspaceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { session, scope, role } = await authorize("manageWorkspace");
  if (role !== "owner") return { error: "Only owners can delete the workspace." };
  const ws = await scope.workspace();
  if (!ws) return { error: "That workspace no longer exists." };
  if (!confirmed(form, ws.login)) return { error: `The confirmation did not match. Type ${ws.login} exactly.` };
  const { deleteWorkspace } = await import("@/lib/data/lifecycle");
  await deleteWorkspace(ws.id, session.userId, await snapshotDeleter());
  await signOut();
  redirect("/");
}

export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { session } = await currentScope();
  if (!confirmed(form, "delete my account")) return { error: "The confirmation did not match. Type delete my account exactly." };
  const { deleteAccount } = await import("@/lib/data/lifecycle");
  try {
    await deleteAccount(session.userId, await snapshotDeleter());
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Your account could not be deleted." };
  }
  await signOut();
  redirect("/");
}

export async function changeMember(form: FormData): Promise<void> {
  const { session, scope, role } = await authorize("manageWorkspace");
  const targetId = String(form.get("userId"));
  const to = String(form.get("role")) as "owner" | "admin" | "member" | "remove";
  if (!["owner", "admin", "member", "remove"].includes(to)) return;
  const members = await scope.members();
  const target = members.find((m) => m.user.id === targetId);
  if (!target || !role) return;
  const { memberChange } = await import("@/lib/domain/members");
  const problem = memberChange({ actor: role, target: target.role, to, owners: members.filter((m) => m.role === "owner").length, self: targetId === session.userId });
  if (problem) redirect(`/settings?tab=team&error=${encodeURIComponent(problem)}`);
  const db = await getDb();
  const where = and(eq(s.memberships.workspaceId, session.workspaceId), eq(s.memberships.userId, targetId));
  if (to === "remove") await db.delete(s.memberships).where(where);
  else await db.update(s.memberships).set({ role: to }).where(where);
  const { audit } = await import("@/lib/data/lifecycle");
  await audit(session.workspaceId, session.userId, to === "remove" ? "member.removed" : "member.role", target.user.login, to === "remove" ? "" : `${target.role} → ${to}`);
  revalidatePath("/settings");
}

/** Admins can release a quarantined test early (for example after fixing its flakiness). */
export async function releaseQuarantine(form: FormData): Promise<void> {
  const { session, allowed } = await authorize("manageRepositories");
  if (!allowed) return;
  const db = await getDb();
  const [t] = await db
    .update(s.memoryTests)
    .set({ quarantined: false, quarantineReason: null, quarantinedAt: null })
    .where(and(eq(s.memoryTests.id, String(form.get("memoryTestId"))), eq(s.memoryTests.workspaceId, session.workspaceId)))
    .returning();
  if (t) {
    await recordActivity({ workspaceId: t.workspaceId, incidentId: t.incidentId, title: "Memory test released from quarantine", detail: "Released by an admin", tone: "pass" });
    const { audit } = await import("@/lib/data/lifecycle");
    await audit(session.workspaceId, session.userId, "test.released", t.path);
  }
  revalidatePath("/memory");
}

/** Starts a still-guarding re-proof for one memory test. */
export async function reproveNow(form: FormData): Promise<void> {
  const { session, allowed } = await authorize("manageRepositories");
  if (!allowed) return;
  const db = await getDb();
  const [t] = await db.select().from(s.memoryTests).where(and(eq(s.memoryTests.id, String(form.get("memoryTestId"))), eq(s.memoryTests.workspaceId, session.workspaceId)));
  if (!t) return;
  const { startReproof } = await import("@/lib/workflows/start");
  await startReproof(t.id);
  revalidatePath("/memory");
}

/** Opens or updates the bot pull request that writes this repository's lessons into AGENTS.md. */
export async function syncLessonsAction(_p: FormState, form: FormData): Promise<FormState> {
  const { session, allowed } = await authorize("manageRepositories");
  if (!allowed) return { error: "Only owners and admins can do this." };
  const { syncAgentsMd } = await import("@/lib/github/agentsSync");
  try {
    const r = await syncAgentsMd(session.workspaceId, String(form.get("repoId") ?? ""));
    if (r.status === "opened") return { ok: `Pull request #${r.pr} updates AGENTS.md. Merge it to share the lessons with coding agents.` };
    if (r.status === "up to date") return { ok: "AGENTS.md already has every lesson." };
    if (r.status === "not connected") return { error: "Install the GitHub App on this repository first." };
    return { error: "This repository has no proven lessons yet." };
  } catch (err) {
    return { error: `GitHub refused the change: ${err instanceof Error ? err.message.slice(0, 160) : "unknown error"}` };
  }
}

/** Imports every waiting closed incident issue (up to 25) and proves those with fixes in the background. */
export async function backfillAction(form: FormData): Promise<void> {
  const { session, allowed } = await authorize("recordIncident");
  if (!allowed) return;
  const limit = Math.max(1, Math.min(25, Number(form.get("limit")) || 25));
  const { startBackfill } = await import("@/lib/workflows/start");
  await startBackfill(session.workspaceId, limit);
  const { audit } = await import("@/lib/data/lifecycle");
  await audit(session.workspaceId, session.userId, "incidents.backfill", `${limit} issues`);
  redirect("/incidents?backfill=started");
}
