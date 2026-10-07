import { complete } from "./provider";
import { fence } from "./fence";
import { TRIAGE_SYSTEM } from "./prompts";
import { parseModelJson } from "./validate";

export type Candidate = { id: string; key: string; title: string; expected: string; files: string[] };

/** Model may only ADD candidates. Any failure adds nothing; file overlap still decides. */
export async function triageIncidents(workspaceId: string, pr: { title: string; diff: string }, candidates: Candidate[]): Promise<string[]> {
  if (candidates.length === 0) return [];
  try {
    const res = await complete(workspaceId, [
      { role: "system", content: TRIAGE_SYSTEM },
      {
        role: "user",
        content: [
          fence("pull request", `Title: ${pr.title}\n\n${pr.diff.slice(0, 30_000)}`),
          fence("candidates", candidates.map((c) => `${c.id} · ${c.key} · ${c.title} · expected: ${c.expected} · files: ${c.files.join(", ")}`).join("\n")),
        ].join("\n\n"),
      },
    ]);
    const out = parseModelJson(res.text) as { add?: unknown };
    const known = new Set(candidates.map((c) => c.id));
    return Array.isArray(out.add) ? [...new Set(out.add.filter((x): x is string => typeof x === "string" && known.has(x)))] : [];
  } catch {
    return [];
  }
}
