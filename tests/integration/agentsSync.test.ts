import { test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { syncAgentsMd } from "@/lib/github/agentsSync";
import { START } from "@/lib/domain/agentsMd";
import { ledgerWorld } from "../support/world";
import { LEDGER_TEST } from "../support/fixtureRepo";

type Call = { route: string; params: Record<string, unknown> };
function fakeGithub(agents: string | null) {
  const calls: Call[] = [];
  let files: Record<string, string> = agents === null ? {} : { "main:AGENTS.md": agents };
  const client = {
    async request(route: string, params: Record<string, unknown>) {
      calls.push({ route, params });
      if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") return { data: { object: { sha: "base-sha" } } };
      if (route === "POST /repos/{owner}/{repo}/git/refs") throw Object.assign(new Error("exists"), { status: 422 });
      if (route === "PATCH /repos/{owner}/{repo}/git/refs/{ref}") return { data: {} };
      if (route === "GET /repos/{owner}/{repo}/contents/{path}") {
        const c = files[`${params.ref}:${params.path}`];
        if (c === undefined) throw Object.assign(new Error("Not Found"), { status: 404 });
        return { data: { sha: `sha-${params.ref}`, content: Buffer.from(c).toString("base64"), encoding: "base64" } };
      }
      if (route === "PUT /repos/{owner}/{repo}/contents/{path}") {
        files = { ...files, [`${params.branch}:${params.path}`]: Buffer.from(String(params.content), "base64").toString() };
        return { data: {} };
      }
      if (route === "POST /repos/{owner}/{repo}/pulls") return { data: { number: 77 } };
      throw new Error(`unexpected ${route}`);
    },
  };
  return { client, calls, file: (k: string) => files[k] };
}

async function world() {
  const w = await ledgerWorld();
  const db = await getDb();
  await db.update(s.incidents).set({ status: "proven", watchedFiles: ["ledger.py"], expected: "retry rejected with 400" }).where(eq(s.incidents.id, w.incident.id));
  await db.insert(s.memoryTests).values({ workspaceId: w.ws.id, incidentId: w.incident.id, repoId: w.repo.id, path: "tests/aftershock/test_inc_1.py", fn: "t", code: LEDGER_TEST });
  return w;
}

test("opens a pull request that adds the lessons section to AGENTS.md on an aftershock/ branch", async () => {
  const w = await world();
  const gh = fakeGithub("# AGENTS.md\n\nUse uv.\n");
  const r = await syncAgentsMd(w.ws.id, w.repo.id, gh.client);
  expect(r).toEqual({ status: "opened", pr: 77 });
  const written = gh.file("aftershock/lessons:AGENTS.md");
  expect(written).toContain("Use uv.");
  expect(written).toContain(START);
  expect(written).toContain("INC-1");
  const put = gh.calls.find((c) => c.route.startsWith("PUT"))!;
  expect(put.params.branch).toBe("aftershock/lessons");
  expect(gh.calls.some((c) => c.route.startsWith("PUT") && c.params.branch === "main")).toBe(false);
  expect(gh.calls.find((c) => c.route === "PATCH /repos/{owner}/{repo}/git/refs/{ref}")?.params).toMatchObject({ ref: "heads/aftershock/lessons", sha: "base-sha", force: true });
});

test("does nothing when AGENTS.md is already up to date, or there are no lessons", async () => {
  const w = await world();
  const first = fakeGithub(null);
  await syncAgentsMd(w.ws.id, w.repo.id, first.client);
  const current = first.file("aftershock/lessons:AGENTS.md");
  const again = fakeGithub(current);
  expect(await syncAgentsMd(w.ws.id, w.repo.id, again.client)).toEqual({ status: "up to date" });
  const empty = await ledgerWorld();
  expect(await syncAgentsMd(empty.ws.id, empty.repo.id, fakeGithub(null).client)).toEqual({ status: "no lessons" });
});
