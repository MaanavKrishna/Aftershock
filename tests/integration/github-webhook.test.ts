import { describe, test, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { handleGithubEvent } from "@/lib/github/webhook";
import { setGithubApi } from "@/lib/github/api";
import { setStartOverride } from "@/lib/workflows/start";

let started: { kind: string; id: string }[] = [];
const login = () => `org-${crypto.randomUUID().slice(0, 8)}`;

beforeEach(() => {
  started = [];
  setStartOverride((kind, id) => void started.push({ kind, id }));
  setGithubApi({
    detectFramework: async () => ({ framework: "pytest", install: "pip install -r requirements.txt", language: "Python" }),
    closingCommit: async () => ({ sha: "aa86f56aa86f56aa86f56aa86f56aa86f56aa86f" }),
    prFiles: async () => ({ files: ["app/services/payment_service.py"], diff: "-guard" }),
    createCheckRun: async () => 555,
  });
});

let inst = 1000;
async function installed(org: string) {
  inst = Math.floor(Math.random() * 1e9);
  await handleGithubEvent("installation", { action: "created", installation: { id: inst, account: { login: org, id: 7, type: "Organization" } }, repositories: [{ id: 1, name: "ecommerce-api", full_name: `${org}/ecommerce-api`, private: false }], sender: { id: 99, login: "dev" } });
  const db = await getDb();
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.login, org));
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.workspaceId, ws.id));
  return { db, ws, repo };
}

describe("GitHub webhooks", () => {
  test("installing the app creates the workspace and its repositories", async () => {
    const org = login();
    const { ws, repo } = await installed(org);
    expect(ws.installationId).toBe(inst);
    expect(repo).toMatchObject({ fullName: `${org}/ecommerce-api`, framework: "pytest", cloneUrl: `https://github.com/${org}/ecommerce-api.git` });
  });

  test("a closed issue labelled incident is imported with its fix and starts time travel", async () => {
    const org = login();
    const { db, ws } = await installed(org);
    await handleGithubEvent("issues", { action: "closed", installation: { id: inst }, repository: { full_name: `${org}/ecommerce-api` }, issue: { number: 41, title: "Payment retry charged twice", body: "Customer charged twice after retry", labels: [{ name: "incident" }] } });
    const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.workspaceId, ws.id));
    expect(inc).toMatchObject({ title: "Payment retry charged twice", source: "issue", sourceRef: "ecommerce-api#41", fixSha: "aa86f56aa86f56aa86f56aa86f56aa86f56aa86f" });
    expect(started).toEqual([{ kind: "timeTravel", id: inc.id }]);
  });

  test("a closed issue without the label is ignored", async () => {
    const org = login();
    const { db, ws } = await installed(org);
    await handleGithubEvent("issues", { action: "closed", installation: { id: inst }, repository: { full_name: `${org}/ecommerce-api` }, issue: { number: 3, title: "Typo", body: "", labels: [{ name: "docs" }] } });
    expect(await db.select().from(s.incidents).where(eq(s.incidents.workspaceId, ws.id))).toEqual([]);
  });

  test("a merged PR that says “Fixes INC-n” links the fix and starts time travel", async () => {
    const org = login();
    const { db, ws, repo } = await installed(org);
    const [inc] = await db.insert(s.incidents).values({ workspaceId: ws.id, repoId: repo.id, number: 16, title: "IntegrityError", source: "sentry", status: "awaiting_fix" }).returning();
    await handleGithubEvent("pull_request", { action: "closed", installation: { id: inst }, repository: { full_name: `${org}/ecommerce-api` }, pull_request: { number: 60, merged: true, merge_commit_sha: "beefbeefbeefbeefbeefbeefbeefbeefbeefbeef", title: "fix: dedupe orders", body: "Fixes INC-16", head: { ref: "fix/orders", sha: "x" }, base: { sha: "y" } } });
    const [after] = await db.select().from(s.incidents).where(eq(s.incidents.id, inc.id));
    expect(after).toMatchObject({ fixSha: "beefbeefbeefbeefbeefbeefbeefbeefbeefbeef", fixPr: 60 });
    expect(started).toEqual([{ kind: "timeTravel", id: inc.id }]);
  });

  test("an opened PR creates a check and starts it", async () => {
    const org = login();
    const { db, ws } = await installed(org);
    await handleGithubEvent("pull_request", { action: "opened", installation: { id: inst }, repository: { full_name: `${org}/ecommerce-api` }, pull_request: { number: 214, title: "refactor: simplify payment service", body: "", head: { ref: "refactor", sha: "7c41e0b7c41e0b7c41e0b7c41e0b7c41e0b7c41e" }, base: { sha: "aa86f56aa86f56aa86f56aa86f56aa86f56aa86f" } } });
    const [check] = await db.select().from(s.prChecks).where(and(eq(s.prChecks.workspaceId, ws.id), eq(s.prChecks.prNumber, 214)));
    expect(check).toMatchObject({ status: "queued", changedFiles: ["app/services/payment_service.py"], checkRunId: 555 });
    expect(started).toEqual([{ kind: "prCheck", id: check.id }]);
  });

  test("Aftershock's own bot branches are not checked", async () => {
    const org = login();
    const { db, ws } = await installed(org);
    await handleGithubEvent("pull_request", { action: "opened", installation: { id: inst }, repository: { full_name: `${org}/ecommerce-api` }, pull_request: { number: 219, title: "Add INC-12 test", body: "", head: { ref: "aftershock/inc-12", sha: "a" }, base: { sha: "b" } } });
    expect(await db.select().from(s.prChecks).where(eq(s.prChecks.workspaceId, ws.id))).toEqual([]);
  });
});
