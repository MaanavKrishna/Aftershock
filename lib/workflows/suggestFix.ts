import type { CheckVerdict } from "@/lib/db/schema";

type Plan =
  | { ok: false }
  | {
      ok: true;
      fixId: string;
      workspaceId: string;
      repo: { url: string; fullName: string; framework: "pytest" | "vitest" | "jest"; install: string };
      headSha: string;
      tests: { id: string; path: string; code: string }[];
      prompt: { file: string; content: string; failing: string; failure: string; diff: string };
      changedFiles: string[];
    };

async function plan(checkId: string): Promise<Plan> {
  "use step";
  const { eq, and } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const { sourceFor } = await import("@/lib/git/source");
  const { deps } = await import("@/lib/timetravel/deps");
  const db = await getDb();
  const [check] = await db.select().from(s.prChecks).where(eq(s.prChecks.id, checkId));
  if (!check || check.verdict !== "recur") return { ok: false };
  const [repo] = await db.select().from(s.repositories).where(eq(s.repositories.id, check.repoId));
  const results = await db
    .select({ r: s.prCheckResults, t: s.memoryTests, i: s.incidents })
    .from(s.prCheckResults)
    .innerJoin(s.memoryTests, eq(s.memoryTests.id, s.prCheckResults.memoryTestId))
    .innerJoin(s.incidents, eq(s.incidents.id, s.memoryTests.incidentId))
    .where(and(eq(s.prCheckResults.checkId, checkId), eq(s.prCheckResults.verdict, "recur")));
  const failing = results[0];
  const tests = await db.select().from(s.memoryTests).where(eq(s.memoryTests.repoId, repo.id));
  const [fix] = await db.insert(s.suggestedFixes).values({ checkId, patch: "", status: "running" }).returning();
  const file = check.changedFiles.find((f) => failing.i.watchedFiles.includes(f)) ?? check.changedFiles[0];
  const token = await (await deps()).tokenFor(repo);
  const content = (await (await sourceFor(repo, token)).readFileAt(check.headSha, file, 60_000)) ?? "";
  return {
    ok: true, fixId: fix.id, workspaceId: check.workspaceId,
    repo: { url: repo.cloneUrl, fullName: repo.fullName, framework: repo.framework, install: repo.installCmd },
    headSha: check.headSha, tests: tests.map((t) => ({ id: t.id, path: t.path, code: t.code })),
    prompt: { file, content, failing: failing.t.code, failure: failing.r.failureExcerpt ?? "the test failed", diff: check.diff },
    changedFiles: check.changedFiles,
  };
}

async function propose(p: Extract<Plan, { ok: true }>): Promise<{ ok: true; path: string; content: string; explanation: string } | { ok: false; reason: string }> {
  "use step";
  const { complete } = await import("@/lib/model/provider");
  const { fence } = await import("@/lib/model/fence");
  const { FIX_SYSTEM } = await import("@/lib/model/prompts");
  const { parseModelJson } = await import("@/lib/model/validate");
  try {
    const res = await complete(p.workspaceId, [
      { role: "system", content: FIX_SYSTEM },
      {
        role: "user",
        content: [
          fence("failing regression test", p.prompt.failing),
          fence("failure", p.prompt.failure),
          fence("pull request diff", p.prompt.diff.slice(0, 30_000)),
          fence(`file ${p.prompt.file} at the pull request head`, p.prompt.content),
          `Return the corrected contents of ${p.prompt.file}.`,
        ].join("\n\n"),
      },
    ]);
    const out = parseModelJson(res.text) as { path?: unknown; content?: unknown; explanation?: unknown };
    if (typeof out.path !== "string" || typeof out.content !== "string") return { ok: false, reason: "The model did not return a file." };
    if (!p.changedFiles.includes(out.path)) return { ok: false, reason: `The suggestion edited ${out.path}, which this pull request never changed.` };
    if (out.content.length > 100_000) return { ok: false, reason: "The suggestion was too large." };
    return { ok: true, path: out.path, content: out.content, explanation: typeof out.explanation === "string" ? out.explanation.slice(0, 500) : "" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "The model did not respond." };
  }
}

async function verify(p: Extract<Plan, { ok: true }>, patch: { path: string; content: string }): Promise<{ memoryTestId: string; verdict: CheckVerdict }[]> {
  "use step";
  const { deps } = await import("@/lib/timetravel/deps");
  const { prVerdict } = await import("@/lib/domain/verdict");
  const d = await deps();
  const token = await d.tokenFor({ workspaceId: p.workspaceId, fullName: p.repo.fullName });
  const out: { memoryTestId: string; verdict: CheckVerdict }[] = [];
  for (const t of p.tests) {
    const r = await d.runner().run({ repoUrl: p.repo.url, token, sha: p.headSha, framework: p.repo.framework, install: p.repo.install, testPath: t.path, testCode: t.code, runs: 2, timeoutMs: 120_000, overlay: [patch] });
    out.push({ memoryTestId: t.id, verdict: prVerdict(r.results) });
  }
  return out;
}

async function save(fixId: string, status: "passed" | "failed", patch: string, explanation: string, results: { memoryTestId: string; verdict: CheckVerdict }[]): Promise<void> {
  "use step";
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("@/lib/db/client");
  const s = await import("@/lib/db/schema");
  const db = await getDb();
  const [row] = await db.update(s.suggestedFixes).set({ status, patch, explanation, results }).where(eq(s.suggestedFixes.id, fixId)).returning();
  if (status === "passed") {
    const { postSuggestion } = await import("@/lib/github/suggest");
    await postSuggestion(row.checkId, row.id).catch(() => undefined);
  }
}

/** A suggested fix is only shown when every memory test for the repository passes with it applied. */
export async function suggestFix(checkId: string): Promise<void> {
  "use workflow";
  const p = await plan(checkId);
  if (!p.ok) return;
  const proposal = await propose(p);
  if (!proposal.ok) {
    await save(p.fixId, "failed", "", proposal.reason, []);
    return;
  }
  const results = await verify(p, { path: proposal.path, content: proposal.content });
  const passed = results.length > 0 && results.every((r) => r.verdict === "safe");
  await save(p.fixId, passed ? "passed" : "failed", JSON.stringify({ path: proposal.path, content: proposal.content }), passed ? proposal.explanation : `${proposal.explanation} It did not pass every memory test, so it was not posted.`.trim(), results);
}
