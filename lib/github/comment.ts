import type { CheckVerdict } from "@/lib/db/schema";

export const COMMENT_MARKER = "<!-- aftershock:check -->";

export type CommentResult = { key: string; title: string; testPath: string; verdict: CheckVerdict; passed: number; runs: number; failure?: string };

/** One comment per pull request, rewritten in place on every push. */
export function renderComment(c: { verdict: CheckVerdict; results: CommentResult[]; skipped: number; url: string; runner?: string }): string {
  const recur = c.results.filter((r) => r.verdict === "recur");
  const lines = [COMMENT_MARKER];
  if (c.verdict === "recur") {
    lines.push(`### Aftershock · ${recur.length} incident${recur.length === 1 ? "" : "s"} would recur`, "", `This change reopens **${recur[0].key}**: ${recur[0].title}.`);
  } else if (c.verdict === "safe") {
    lines.push("### Aftershock · Safe", "", "Every relevant incident stayed fixed on this change.");
  } else if (c.verdict === "inconclusive") {
    lines.push("### Aftershock · Inconclusive", "", "Some results were mixed or the environment failed, so this check is not green. Re-run it, or mark the test flaky.");
  } else {
    lines.push("### Aftershock · Skipped", "", "No remembered incident is relevant to the files this change touches.");
  }
  if (c.results.length) {
    lines.push("", "| Incident | Proven test | Result |", "| --- | --- | --- |");
    for (const r of c.results) lines.push(`| ${r.key} | \`${r.testPath}\` | ${r.passed}/${r.runs} pass |`);
  }
  for (const r of recur) if (r.failure) lines.push("", "```", r.failure.slice(0, 1500), "```");
  lines.push("", `${c.results.length} relevant · ${c.skipped} skipped${c.runner ? ` · ran in ${c.runner}` : ""} · [Open the trace](${c.url})`);
  return lines.join("\n");
}
