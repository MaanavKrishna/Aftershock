import path from "node:path";
import type { Framework } from "@/lib/runner/types";
import { frameworkDef } from "@/lib/runner/frameworks";

export class InvalidModelOutput extends Error {
  name = "InvalidModelOutput";
}

/** Parses the single JSON object a model was asked for. Tolerates a ```json fence; nothing else. */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new InvalidModelOutput("The model did not return JSON");
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new InvalidModelOutput("The model returned malformed JSON");
  }
}

function balanced(code: string): boolean {
  const stripped = code
    .replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, "")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, '""')
    .replace(/#[^\n]*|\/\/[^\n]*/g, "");
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (const ch of stripped) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (ch in pairs && stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}

/** A draft is exactly one test file, inside the test folder, of the framework's type, that defines a test. */
export function validateDraft(out: unknown, cfg: { framework: Framework; testDir: string }): { path: string; code: string } {
  if (!out || typeof out !== "object") throw new InvalidModelOutput("The model returned no draft");
  const o = out as Record<string, unknown>;
  if (Array.isArray(o.files)) {
    if (o.files.length !== 1) throw new InvalidModelOutput("A draft must be exactly one file");
    return validateDraft(o.files[0], cfg);
  }
  if (typeof o.path !== "string" || typeof o.code !== "string") throw new InvalidModelOutput("The draft needs a path and code");
  const norm = path.posix.normalize(o.path.replace(/\\/g, "/"));
  const def = frameworkDef(cfg.framework);
  if (norm.startsWith("/") || norm.split("/").includes("..") || o.path.split("/").includes("..")) throw new InvalidModelOutput("The draft path must stay inside the repository");
  const pathProblem = def.checkDraftPath(norm, cfg.testDir);
  if (pathProblem) throw new InvalidModelOutput(pathProblem);
  if (o.code.length > 30_000) throw new InvalidModelOutput("The draft is larger than 30 KB");
  if (!def.definesTest(o.code)) throw new InvalidModelOutput("The draft defines no test");
  if (!balanced(o.code)) throw new InvalidModelOutput("The draft has unbalanced brackets");
  return { path: norm, code: o.code };
}
