import { complete } from "./provider";
import { fence } from "./fence";
import { EXTRACT_SYSTEM } from "./prompts";
import { parseModelJson, InvalidModelOutput } from "./validate";

const FIELDS = ["title", "trigger", "observed", "expected", "fix"] as const;

/** Postmortem → editable incident fields. The human checks them before saving. */
export async function extractIncident(text: string, workspaceId?: string): Promise<Record<(typeof FIELDS)[number], string>> {
  if (!workspaceId) {
    const { currentScope } = await import("@/lib/auth/scope");
    workspaceId = (await currentScope()).session.workspaceId;
  }
  const res = await complete(workspaceId, [
    { role: "system", content: EXTRACT_SYSTEM },
    { role: "user", content: fence("postmortem", text.slice(0, 40_000)) },
  ]);
  const out = parseModelJson(res.text) as Record<string, unknown>;
  if (typeof out.title !== "string" || !out.title.trim()) throw new InvalidModelOutput("The model could not find a title in the postmortem");
  return Object.fromEntries(FIELDS.map((f) => [f, typeof out[f] === "string" ? (out[f] as string).trim().slice(0, 4000) : ""])) as Record<(typeof FIELDS)[number], string>;
}
