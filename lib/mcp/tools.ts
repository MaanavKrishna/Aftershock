import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { scoped } from "@/lib/db/queries/scope";
import { incidentKey } from "@/lib/domain/ids";
import { relevantTests } from "@/lib/domain/relevance";
import { renderLessons } from "@/lib/domain/lessons";

export type ToolCtx = { workspaceId: string; scope: "read" | "write" };
export type ToolResult = { text: string; data: Record<string, unknown>; isError?: boolean };
type Tool<S extends z.ZodType> = { name: string; title: string; description: string; input: S; write?: boolean; readOnly: boolean; run: (args: z.infer<S>, ctx: ToolCtx) => Promise<ToolResult> };
const tool = <S extends z.ZodType>(t: Tool<S>) => t;

async function memoryOf(workspaceId: string) {
  const sc = scoped(workspaceId);
  const ws = await sc.workspace();
  const rows = await sc.memory();
  return rows.map((r) => ({ id: r.test.id, key: incidentKey(ws!.incidentPrefix, r.incident.number), title: r.incident.title, expected: r.incident.expected, files: r.incident.watchedFiles, test: r.test.path, repository: r.repo.name, health: r.test.health, quarantined: r.test.quarantined, guardStatus: r.test.guardStatus }));
}

export const TOOLS = [
  tool({
    name: "check_change",
    title: "Check a change against past incidents",
    description: "Before committing, pass the files you changed. Returns the past production incidents whose proven regression tests cover those files, what the correct behaviour is, and which test will run on the pull request. Use it to avoid reintroducing a known bug.",
    input: z.object({ files: z.array(z.string().max(500)).min(1).max(500).describe("Repository-relative paths you changed"), repository: z.string().max(200).optional().describe("Repository name, if the workspace has several") }),
    readOnly: true,
    async run({ files, repository }, ctx) {
      const mem = (await memoryOf(ctx.workspaceId)).filter((m) => !repository || m.repository === repository || repository.endsWith(`/${m.repository}`));
      const sel = relevantTests(files, mem.map((m) => ({ id: m.id, watchedFiles: m.files })), []);
      const atRisk = sel.run.map((r) => {
        const m = mem.find((x) => x.id === r.id)!;
        return { incident: m.key, title: m.title, expected: m.expected, test: m.test, repository: m.repository, because: `touches ${files.find((f) => m.files.includes(f))}` };
      });
      const text = atRisk.length
        ? [`This change touches code from ${atRisk.length} past incident${atRisk.length === 1 ? "" : "s"}. Keep this behaviour:`, ...atRisk.map((a) => `- ${a.incident} ${a.title}: ${a.expected || "see the incident"} (${a.because}; test ${a.test})`), "", "Run those tests locally before pushing; Aftershock will run them on the pull request."].join("\n")
        : "No past incident covers these files.";
      return { text, data: { atRisk } };
    },
  }),
  tool({
    name: "list_lessons",
    title: "Lessons from production",
    description: "Lessons learned from past incidents, as markdown, optionally only those about files under a path.",
    input: z.object({ path: z.string().max(500).optional().describe("Only lessons about files starting with this path") }),
    readOnly: true,
    async run({ path }, ctx) {
      const mem = (await memoryOf(ctx.workspaceId)).filter((m) => !path || m.files.some((f) => f.startsWith(path)));
      const md = renderLessons(mem.map((m) => ({ key: m.key, title: m.title, files: m.files, expected: m.expected, testPath: m.test })));
      return { text: md, data: { count: mem.length, markdown: md } };
    },
  }),
  tool({
    name: "get_incident",
    title: "Get one incident",
    description: "One incident by key (for example INC-12): what happened, the fix, its proven test, health on main and the commit that introduced it.",
    input: z.object({ key: z.string().max(40).describe("Incident key, e.g. INC-12") }),
    readOnly: true,
    async run({ key }, ctx) {
      const sc = scoped(ctx.workspaceId);
      const ws = await sc.workspace();
      const n = Number(key.match(/(\d+)\s*$/)?.[1]);
      const inc = Number.isFinite(n) ? await sc.getIncident(n) : null;
      if (!inc) return { text: `No incident ${key} in this workspace.`, data: {}, isError: true };
      const m = (await memoryOf(ctx.workspaceId)).find((x) => x.key === incidentKey(ws!.incidentPrefix, inc.number));
      const data = { key: incidentKey(ws!.incidentPrefix, inc.number), title: inc.title, status: inc.status, trigger: inc.trigger, observed: inc.observed, expected: inc.expected, files: inc.watchedFiles, fix: { sha: inc.fixSha, pr: inc.fixPr }, epicenter: inc.epicenter ?? null, memoryTest: m ? { path: m.test, health: m.health, quarantined: m.quarantined, guardStatus: m.guardStatus } : null };
      return { text: JSON.stringify(data, null, 2), data };
    },
  }),
  tool({
    name: "list_incidents",
    title: "List incidents",
    description: "Incidents in the workspace with their status (awaiting_fix, traveling, proven, unproven).",
    input: z.object({ status: z.enum(["awaiting_fix", "traveling", "proven", "unproven"]).optional() }),
    readOnly: true,
    async run({ status }, ctx) {
      const sc = scoped(ctx.workspaceId);
      const ws = await sc.workspace();
      const rows = await sc.listIncidents(status ? { status } : {});
      const incidents = rows.slice(0, 200).map((i) => ({ key: incidentKey(ws!.incidentPrefix, i.number), title: i.title, status: i.status, source: i.source }));
      return { text: incidents.map((i) => `${i.key} [${i.status}] ${i.title}`).join("\n") || "No incidents.", data: { incidents } };
    },
  }),
  tool({
    name: "ask",
    title: "Ask about past incidents",
    description: "Ask a question about this team's production incidents (for example: what went wrong in the payments code before?). Answers come only from recorded incidents and cite their keys.",
    input: z.object({ question: z.string().min(4).max(500) }),
    readOnly: true,
    async run({ question }, ctx) {
      const { askAftershock } = await import("@/lib/model/ask");
      const r = await askAftershock(ctx.workspaceId, question);
      const text = [r.answer, ...r.citations.map((c) => `- ${c.key}: ${c.title}`)].join("\n");
      return { text, data: { answered: r.answered, answer: r.answer, citations: r.citations } };
    },
  }),
  tool({
    name: "run_check",
    title: "Re-run a pull request check",
    description: "Re-runs Aftershock's check for a pull request (needs a token with write access). Results appear on the pull request.",
    input: z.object({ repository: z.string().max(200), pr: z.number().int().positive() }),
    write: true,
    readOnly: false,
    async run({ repository, pr }, ctx) {
      if (ctx.scope !== "write") return { text: "This token is read-only. run_check needs a token with write access.", data: {}, isError: true };
      const repo = (await scoped(ctx.workspaceId).repos()).find((r) => r.name === repository || r.fullName === repository);
      if (!repo) return { text: `No repository ${repository} in this workspace.`, data: {}, isError: true };
      const db = await getDb();
      const [check] = await db.select().from(s.prChecks).where(and(eq(s.prChecks.repoId, repo.id), eq(s.prChecks.prNumber, pr), isNull(s.prChecks.mergeGroupRef))).orderBy(desc(s.prChecks.createdAt)).limit(1);
      if (!check) return { text: `Aftershock has not seen pull request #${pr} yet. Push to it to start a check.`, data: {}, isError: true };
      await db.update(s.prChecks).set({ status: "queued", verdict: null }).where(eq(s.prChecks.id, check.id));
      const { startPrCheck } = await import("@/lib/workflows/start");
      await startPrCheck(check.id);
      return { text: `Started the check for ${repo.name}#${pr}.`, data: { started: true } };
    },
  }),
] as const;
