import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { incidentKey } from "@/lib/domain/ids";
import { complete } from "./provider";
import { fence, FENCE_RULE } from "./fence";
import { parseModelJson } from "./validate";

const STOP = new Set("a an the and or of in on at to for from with when what which who how why is are was were be been do does did we our us you your it its this that there they them about into than then any all can could should would will".split(" "));
const stem = (w: string) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);
const words = (t: string) => new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem));

export type Citation = { key: string; title: string; url: string };
export type Answer = { answered: boolean; answer: string; citations: Citation[] };

const SYSTEM = [
  "You answer questions about a software team's production incidents, using only the incidents provided.",
  FENCE_RULE,
  'Reply with JSON only: {"answer": string, "cite": string[]} where cite lists the incident keys (like "INC-3") your answer relies on.',
  "Every claim must come from a cited incident. If the incidents don't answer the question, reply {\"answer\": \"\", \"cite\": []}.",
  "Be brief: at most 5 sentences. Mention incident keys inline.",
].join("\n");

/**
 * Grounded Q&A over the workspace's incidents. Retrieval is local (word overlap with titles, symptoms,
 * expectations and files); the model only sees the best matches, fenced, and must cite them. Answers
 * citing nothing real are discarded, and the relevant incidents are shown instead.
 */
export async function askAftershock(workspaceId: string, question: string): Promise<Answer> {
  const q = question.trim().slice(0, 500);
  const db = await getDb();
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  const rows = await db.select().from(s.incidents).where(eq(s.incidents.workspaceId, workspaceId)).limit(2000);
  const qw = words(q);
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const ranked = rows
    .map((i) => {
      const w = words(`${i.title} ${i.observed} ${i.expected} ${i.trigger} ${i.watchedFiles.join(" ")} ${i.epicenter && "title" in i.epicenter ? (i.epicenter.title ?? "") : ""}`);
      let score = 0;
      for (const x of qw) if (w.has(x)) score++;
      return { i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.i.number - a.i.number)
    .slice(0, 8);
  const cite = (i: (typeof rows)[number]): Citation => ({ key: incidentKey(ws.incidentPrefix, i.number), title: i.title, url: `${base}/incidents/${i.number}` });
  const fallback = (): Answer => ({ answered: false, answer: ranked.length ? "I couldn't answer that from your incidents. These look relevant:" : "No incident in this workspace matches that question.", citations: ranked.slice(0, 5).map((x) => cite(x.i)) });
  if (!ranked.length || !qw.size) return fallback();
  const context = ranked.map(({ i }) => [`${incidentKey(ws.incidentPrefix, i.number)} · ${i.status} · ${i.title}`, `Trigger: ${i.trigger}`, `Observed: ${i.observed}`, `Expected: ${i.expected}`, `Files: ${i.watchedFiles.join(", ")}`, i.epicenter && "sha" in i.epicenter ? `Introduced in ${i.epicenter.sha}${i.epicenter.prNumber ? ` (PR #${i.epicenter.prNumber})` : ""}` : ""].filter(Boolean).join("\n").slice(0, 1500)).join("\n\n");
  try {
    const res = await complete(workspaceId, [
      { role: "system", content: SYSTEM },
      { role: "user", content: `${fence("question", q)}\n\n${fence("incidents", context)}` },
    ]);
    const out = parseModelJson(res.text) as { answer?: unknown; cite?: unknown };
    const allowed = new Map(ranked.map(({ i }) => [incidentKey(ws.incidentPrefix, i.number), i]));
    const keys = Array.isArray(out.cite) ? [...new Set(out.cite.filter((k): k is string => typeof k === "string" && allowed.has(k)))] : [];
    const answer = typeof out.answer === "string" ? out.answer.trim().slice(0, 1500) : "";
    if (!answer || !keys.length) return fallback();
    return { answered: true, answer, citations: keys.map((k) => cite(allowed.get(k)!)) };
  } catch {
    return fallback();
  }
}
