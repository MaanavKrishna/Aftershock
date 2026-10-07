import type { RunResult } from "@/lib/domain/verdict";

const unescape = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? unescape(m[1]) : undefined;
}

/**
 * One test file's JUnit report → one run result.
 * <failure> is an assertion that ran and failed. <error>, <skipped>, or no testcase at all
 * means the test never really ran — an environment error, never evidence.
 */
export function parseJUnit(xml: string, durationMs: number): RunResult {
  const cases = xml.match(/<testcase\b[\s\S]*?(?:\/>|<\/testcase>)/g) ?? [];
  if (cases.length === 0) {
    const suiteErr = xml.match(/<testsuite\b[^>]*\serrors="([1-9]\d*)"/);
    return { outcome: "error", durationMs, message: suiteErr ? "The test file failed to load" : "No test ran" };
  }
  for (const c of cases) {
    const err = c.match(/<error\b[^>]*>/);
    if (err) return { outcome: "error", durationMs, message: attr(err[0], "message") ?? "Test errored before running" };
    if (/<skipped\b/.test(c)) return { outcome: "error", durationMs, message: "The test was skipped" };
  }
  for (const c of cases) {
    const f = c.match(/<failure\b[^>]*>/);
    if (f) {
      const body = c.match(/<failure\b[^>]*>([\s\S]*?)<\/failure>/)?.[1];
      return { outcome: "failed", durationMs, message: attr(f[0], "message") ?? unescape(body ?? "").trim().split("\n").at(-1) ?? "failed" };
    }
  }
  return { outcome: "passed", durationMs };
}

export const MISSING_CODE = /failed to load|collection failure|ImportError|ModuleNotFoundError|NameError|Cannot find module|has no attribute|is not a function|is not exported|does not provide an export/i;

/** A result that means the code under test is missing at this commit (it cannot be imported or named), not a broken environment. */
export function codeAbsent(r: RunResult): boolean {
  return (r.outcome === "error" || r.outcome === "failed") && MISSING_CODE.test(r.message ?? "");
}
