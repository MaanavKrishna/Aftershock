import { describe, test, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { scoped } from "@/lib/db/queries/scope";

// Server actions read the signed-in member from cookies; here the member is set per test.
const who = vi.hoisted(() => ({ current: null as null | { workspaceId: string; userId: string; role: "owner" | "admin" | "member" } }));
vi.mock("@/lib/auth/scope", async () => {
  const { scoped } = await import("@/lib/db/queries/scope");
  const { can } = await import("@/lib/auth/roles");
  const ctx = () => ({ session: { workspaceId: who.current!.workspaceId, userId: who.current!.userId }, scope: scoped(who.current!.workspaceId) });
  return {
    currentScope: async () => ctx(),
    authorize: async (action: import("@/lib/auth/roles").Action) => ({ ...ctx(), role: who.current!.role, allowed: can(who.current!.role, action) }),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

async function world() {
  const db = await getDb();
  const login = `w-${crypto.randomUUID().slice(0, 8)}`;
  const [ws] = await db.insert(s.workspaces).values({ login, name: login, settings: { flags: { reproof: true }, issueLabel: "bug" } }).returning();
  const [user] = await db.insert(s.users).values({ githubId: String(Math.floor(Math.random() * 1e12)), login }).returning();
  await db.insert(s.memberships).values({ workspaceId: ws.id, userId: user.id, role: "owner" });
  const [repo] = await db.insert(s.repositories).values({ workspaceId: ws.id, name: "shop", fullName: `${login}/shop`, cloneUrl: "https://github.com/x/shop.git", framework: "pytest", installCmd: "pip install -r requirements.txt" }).returning();
  const [check] = await db.insert(s.prChecks).values({ workspaceId: ws.id, repoId: repo.id, prNumber: 8, title: "t", headSha: "h", baseSha: "b", status: "done", verdict: "recur" }).returning();
  const [inc] = await db.insert(s.incidents).values({ workspaceId: ws.id, repoId: repo.id, number: 1, title: "Retry charged twice", source: "form", status: "awaiting_fix", suggestedFix: { pr: 3, sha: "abc1234", title: "fix", why: "closes it" } }).returning();
  const [test] = await db.insert(s.memoryTests).values({ workspaceId: ws.id, incidentId: inc.id, repoId: repo.id, path: "t.py", fn: "t", quarantined: true, quarantineReason: "flaky" }).returning();
  return { db, ws, user, repo, check, inc, test, sc: scoped(ws.id) };
}

const overridesFor = async (checkId: string) => (await getDb()).select().from(s.overrides).where(eq(s.overrides.checkId, checkId));
const checkRow = async (id: string) => (await (await getDb()).select().from(s.prChecks).where(eq(s.prChecks.id, id)))[0];

beforeEach(() => {
  who.current = null;
});

describe("scoped writes", () => {
  test("an override and the check's flag are written together", async () => {
    const w = await world();
    expect((await w.sc.overrideCheck(w.check.id, w.user.id, "x".repeat(3000)))?.id).toBe(w.check.id);
    expect((await checkRow(w.check.id)).overridden).toBe(true);
    const [o] = await overridesFor(w.check.id);
    expect(o).toMatchObject({ userId: w.user.id });
    expect(o.reason.length).toBe(2000);
  });

  test("if recording the override fails, the check is not marked overridden", async () => {
    const w = await world();
    // A user id that does not exist breaks the override's foreign key after the check was updated.
    await expect(w.sc.overrideCheck(w.check.id, "no-such-user", "a long enough reason")).rejects.toThrow();
    expect((await checkRow(w.check.id)).overridden).toBe(false);
    expect(await overridesFor(w.check.id)).toEqual([]);
  });

  test("ids from another workspace change nothing", async () => {
    const [a, b] = [await world(), await world()];
    expect(await b.sc.overrideCheck(a.check.id, b.user.id, "a long enough reason")).toBeNull();
    expect((await checkRow(a.check.id)).overridden).toBe(false);
    expect(await b.sc.checkById(a.check.id)).toBeNull();
    expect(await b.sc.updateIncident(a.inc.id, { title: "hijacked" })).toBeNull();
    expect(await b.sc.addNote(a.inc.id, b.user.id, "hi")).toBe(false);
    expect(await b.sc.releaseQuarantine(a.test.id)).toBeNull();
    expect(await b.sc.memoryTest(a.test.id)).toBeNull();
    await b.sc.updateRepo(a.repo.id, { runner: "actions" });
    await b.sc.setMemberRole(a.user.id, "remove");
    const db = await getDb();
    expect((await db.select().from(s.incidents).where(eq(s.incidents.id, a.inc.id)))[0].title).toBe("Retry charged twice");
    expect((await db.select().from(s.repositories).where(eq(s.repositories.id, a.repo.id)))[0].runner).toBe("sandbox");
    expect(await a.sc.me(a.user.id)).not.toBeNull();
    expect((await a.sc.memoryTest(a.test.id))?.quarantined).toBe(true);
  });

  test("workspace settings are merged, never replaced", async () => {
    const w = await world();
    await w.sc.updateWorkspace({ name: "Renamed" }, (cur) => ({ ...cur, autoImportIssues: true }));
    await w.sc.updateWorkspace({}, (cur) => ({ ...cur, flags: { ...cur.flags, digest: true } }));
    const ws = await w.sc.workspace();
    expect(ws).toMatchObject({ name: "Renamed", settings: { issueLabel: "bug", autoImportIssues: true, flags: { reproof: true, digest: true } } });
  });

  test("tokens, integrations and memberships", async () => {
    const w = await world();
    await w.sc.createToken({ name: "ci", prefix: "p", hash: `h-${w.ws.id}`, scope: "read" });
    const [tok] = await w.sc.tokens();
    expect(tok).toMatchObject({ name: "ci", scope: "read", workspaceId: w.ws.id });
    await w.sc.revokeToken(tok.id);
    expect(await w.sc.tokens()).toEqual([]);
    await w.sc.upsertIntegration("model", { provider: "muse" }, "secret-1");
    await w.sc.upsertIntegration("model", { provider: "custom" });
    const [model] = await w.sc.integrations();
    expect(model).toMatchObject({ config: { provider: "custom" }, secretCiphertext: "secret-1" });
    await w.sc.setMemberRole(w.user.id, "admin");
    expect((await w.sc.me(w.user.id))?.role).toBe("admin");
  });
});

describe("overrideCheck action", () => {
  test("refuses members, short reasons and unknown checks, then records the override with activity", async () => {
    const { overrideCheck } = await import("@/app/(app)/actions");
    const w = await world();
    const form = (checkId: string, reason: string) => {
      const f = new FormData();
      f.set("checkId", checkId);
      f.set("reason", reason);
      return f;
    };
    who.current = { workspaceId: w.ws.id, userId: w.user.id, role: "member" };
    expect(await overrideCheck({}, form(w.check.id, "a long enough reason"))).toEqual({ error: "Only owners and admins can do this." });
    who.current.role = "admin";
    expect((await overrideCheck({}, form(w.check.id, "short"))).error).toMatch(/at least 10 characters/);
    expect(await overrideCheck({}, form("missing", "a long enough reason"))).toEqual({ error: "Check not found." });
    expect(await overrideCheck({}, form(w.check.id, "a long enough reason"))).toEqual({ ok: "Override recorded." });
    expect((await checkRow(w.check.id)).overridden).toBe(true);
    expect((await overridesFor(w.check.id)).length).toBe(1);
    const acts = await w.db.select().from(s.activity).where(eq(s.activity.workspaceId, w.ws.id));
    expect(acts.map((a) => a.title)).toContain("PR #8 check overridden");
  });

  test("dismissing and editing go through the workspace scope", async () => {
    const { dismissSuggestedFix, editIncident } = await import("@/app/(app)/actions");
    const [a, b] = [await world(), await world()];
    who.current = { workspaceId: b.ws.id, userId: b.user.id, role: "owner" };
    const f = new FormData();
    f.set("incidentId", a.inc.id);
    f.set("title", "Changed from elsewhere");
    await dismissSuggestedFix(f);
    expect(await editIncident({}, f)).toEqual({ error: "Incident not found." });
    const [still] = await a.db.select().from(s.incidents).where(eq(s.incidents.id, a.inc.id));
    expect(still.suggestedFix).not.toBeNull();
    expect(still.title).toBe("Retry charged twice");
    who.current = { workspaceId: a.ws.id, userId: a.user.id, role: "owner" };
    await dismissSuggestedFix(f);
    expect(await editIncident({}, f)).toEqual({ ok: "Details saved." });
    const [after] = await a.db.select().from(s.incidents).where(eq(s.incidents.id, a.inc.id));
    expect(after).toMatchObject({ suggestedFix: null, title: "Changed from elsewhere" });
  });
});
