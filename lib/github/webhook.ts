import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey, parseIncidentRefs } from "@/lib/domain/ids";
import { github } from "./api";
import { fieldsFromIssue } from "@/lib/domain/issueBody";

const clip = (f: { trigger: string; observed: string; expected: string }) => ({ trigger: f.trigger.slice(0, 2000), observed: f.observed.slice(0, 4000), expected: f.expected.slice(0, 2000) });

type Repo = { id: number; name: string; full_name: string };
type Payload = Record<string, any>; // GitHub payloads; only the fields read below are trusted, after the signature check.

async function workspaceByInstallation(installationId: number | undefined) {
  if (!installationId) return null;
  const db = await getDb();
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.installationId, installationId));
  return ws ?? null;
}

async function repoByFullName(workspaceId: string, fullName: string) {
  const db = await getDb();
  const [r] = await db.select().from(s.repositories).where(and(eq(s.repositories.workspaceId, workspaceId), eq(s.repositories.fullName, fullName)));
  return r ?? null;
}

async function logDelivery(workspaceId: string, event: string, detail: string, ok = true) {
  const db = await getDb();
  await db.insert(s.deliveries).values({ workspaceId, kind: "github", event, detail, ok });
}

async function addRepos(workspaceId: string, repos: Repo[]) {
  const db = await getDb();
  for (const r of repos) {
    if (await repoByFullName(workspaceId, r.full_name)) continue;
    const d = await github.detectFramework(workspaceId, r.full_name);
    await db.insert(s.repositories).values({ workspaceId, githubRepoId: String(r.id), fullName: r.full_name, name: r.name, cloneUrl: `https://github.com/${r.full_name}.git`, framework: d.framework, installCmd: d.install, language: d.language });
  }
}

async function nextNumber(workspaceId: string) {
  const { scoped } = await import("@/lib/db/queries/scope");
  return scoped(workspaceId).nextIncidentNumber();
}

/** Routes one verified GitHub delivery. Returns a short note for the delivery log. */
export async function handleGithubEvent(name: string, p: Payload): Promise<{ note: string }> {
  const db = await getDb();
  const { startTimeTravel, startPrCheck } = await import("@/lib/workflows/start");

  if (name === "installation" && p.action === "created") {
    const account = p.installation.account;
    const [ws] = await db
      .insert(s.workspaces)
      .values({ login: account.login, name: account.login, installationId: p.installation.id, settings: { autoImportIssues: true, autoTravelOnMerge: true, issueLabel: "incident" } })
      .onConflictDoUpdate({ target: s.workspaces.login, set: { installationId: p.installation.id } })
      .returning();
    if (p.sender?.id) {
      const [user] = await db.select().from(s.users).where(eq(s.users.githubId, String(p.sender.id)));
      if (user) await db.insert(s.memberships).values({ workspaceId: ws.id, userId: user.id, role: "owner" }).onConflictDoNothing();
    }
    await addRepos(ws.id, p.repositories ?? []);
    await logDelivery(ws.id, "installation.created", `${(p.repositories ?? []).length} repositories`);
    return { note: "installed" };
  }

  const ws = await workspaceByInstallation(p.installation?.id);
  if (!ws) return { note: "no workspace for this installation" };

  if (name === "installation" && p.action === "deleted") {
    await db.update(s.workspaces).set({ installationId: null }).where(eq(s.workspaces.id, ws.id));
    await logDelivery(ws.id, "installation.deleted", "GitHub App removed");
    return { note: "uninstalled" };
  }

  if (name === "installation_repositories") {
    await addRepos(ws.id, p.repositories_added ?? []);
    await logDelivery(ws.id, `installation_repositories.${p.action}`, `${(p.repositories_added ?? []).length} added`);
    return { note: "repositories updated" };
  }

  const repo = p.repository?.full_name ? await repoByFullName(ws.id, p.repository.full_name) : null;
  if (!repo) return { note: "repository not tracked" };

  if (name === "issues" && p.action === "closed") {
    const label = (ws.settings.issueLabel ?? "incident").toLowerCase();
    const labelled = (p.issue.labels ?? []).some((l: { name: string }) => l.name.toLowerCase() === label);
    if (!labelled || ws.settings.autoImportIssues === false) return { note: "issue not labelled" };
    const ref = `${repo.name}#${p.issue.number}`;
    const [dupe] = await db.select().from(s.incidents).where(and(eq(s.incidents.workspaceId, ws.id), eq(s.incidents.sourceRef, ref)));
    if (dupe) return { note: "already imported" };
    const fix = await github.closingCommit(ws.id, repo.fullName, p.issue.number);
    const [inc] = await db
      .insert(s.incidents)
      .values({
        workspaceId: ws.id, repoId: repo.id, number: await nextNumber(ws.id), title: String(p.issue.title).slice(0, 200), ...clip(fieldsFromIssue(String(p.issue.body ?? ""))),
        source: "issue", sourceRef: ref, fixSha: fix.sha ?? null, fixPr: fix.pr ?? null, status: "awaiting_fix",
        statusReason: fix.sha || fix.pr ? null : "The issue was closed without a linked fix. Link the fix commit or PR to start time travel.",
      })
      .returning();
    await db.insert(s.activity).values({ workspaceId: ws.id, incidentId: inc.id, title: `Imported from issue #${p.issue.number}`, detail: `${incidentKey(ws.incidentPrefix, inc.number)} · ${repo.name}`, tone: "pass" });
    await logDelivery(ws.id, "issues.closed", `#${p.issue.number} labelled ${label}`);
    if (fix.sha || fix.pr) await startTimeTravel(inc.id);
    return { note: "incident imported" };
  }

  if (name === "pull_request") {
    const pr = p.pull_request;
    if (String(pr.head?.ref ?? "").startsWith("aftershock/")) {
      if (p.action === "closed") {
        await db.update(s.memoryTests).set({ botPrState: pr.merged ? "merged" : "closed" }).where(and(eq(s.memoryTests.workspaceId, ws.id), eq(s.memoryTests.botPr, pr.number)));
      }
      return { note: "own branch" };
    }
    if (p.action === "closed" && pr.merged) {
      const refs = parseIncidentRefs(`${pr.title}\n${pr.body ?? ""}`, ws.incidentPrefix);
      if (refs.length && ws.settings.autoTravelOnMerge !== false) {
        const waiting = await db.select().from(s.incidents).where(and(eq(s.incidents.workspaceId, ws.id), inArray(s.incidents.number, refs), inArray(s.incidents.status, ["awaiting_fix", "unproven"])));
        for (const inc of waiting) {
          await db.update(s.incidents).set({ repoId: inc.repoId ?? repo.id, fixSha: pr.merge_commit_sha, fixPr: pr.number, fixTitle: String(pr.title).slice(0, 200), parentSha: null, updatedAt: new Date() }).where(eq(s.incidents.id, inc.id));
          await db.insert(s.activity).values({ workspaceId: ws.id, incidentId: inc.id, title: "Fix merged", detail: `PR #${pr.number} · ${String(pr.title).slice(0, 120)}`, tone: "pass" });
          await startTimeTravel(inc.id);
        }
      }
      await logDelivery(ws.id, "pull_request.closed", `#${pr.number} merged${refs.length ? ` · fixes ${refs.map((n) => incidentKey(ws.incidentPrefix, n)).join(", ")}` : ""}`);
      return { note: "merged" };
    }
    if (["opened", "synchronize", "reopened", "ready_for_review"].includes(p.action)) {
      const { files, diff } = await github.prFiles(ws.id, repo.fullName, pr.number);
      const checkRunId = await github.createCheckRun(ws.id, repo.fullName, pr.head.sha);
      const [prev] = await db.select().from(s.prChecks).where(and(eq(s.prChecks.repoId, repo.id), eq(s.prChecks.prNumber, pr.number))).limit(1);
      const [check] = await db
        .insert(s.prChecks)
        .values({ workspaceId: ws.id, repoId: repo.id, prNumber: pr.number, title: String(pr.title).slice(0, 200), headSha: pr.head.sha, baseSha: pr.base.sha, filesChanged: files.length, changedFiles: files, diff, status: "queued", checkRunId, commentId: prev?.commentId ?? null })
        .returning();
      await db.update(s.repositories).set({ lastCheckAt: new Date() }).where(eq(s.repositories.id, repo.id));
      await logDelivery(ws.id, `pull_request.${p.action}`, `#${pr.number} · signature ok`);
      await startPrCheck(check.id);
      return { note: "check started" };
    }
  }

  if (name === "check_run" && p.action === "rerequested") {
    const [check] = await db.select().from(s.prChecks).where(and(eq(s.prChecks.workspaceId, ws.id), eq(s.prChecks.checkRunId, p.check_run.id)));
    if (check) {
      await db.update(s.prChecks).set({ status: "queued", verdict: null }).where(eq(s.prChecks.id, check.id));
      await logDelivery(ws.id, "check_run.rerequested", `#${check.prNumber}`);
      await startPrCheck(check.id);
    }
    return { note: "re-run" };
  }

  return { note: "ignored" };
}
