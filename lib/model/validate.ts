import path from "node:path";
import type { Framework } from "@/lib/runner/types";

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
  const dir = cfg.testDir.replace(/\/$/, "");
  if (norm.startsWith("/") || norm.split("/").includes("..") || o.path.split("/").includes("..")) throw new InvalidModelOutput("The draft path must stay inside the repository");
  if (!norm.startsWith(dir + "/")) throw new InvalidModelOutput(`The draft must live under ${dir}/`);
  const base = path.posix.basename(norm);
  if (cfg.framework === "pytest" ? !/^(test_\w+|\w+_test)\.py$/.test(base) : !/\.(test|spec)\.[cm]?[jt]sx?$/.test(base)) {
    throw new InvalidModelOutput(cfg.framework === "pytest" ? "pytest drafts must be test_*.py files" : `${cfg.framework} drafts must be *.test.ts or *.test.js files`);
  }
  if (o.code.length > 30_000) throw new InvalidModelOutput("The draft is larger than 30 KB");
  const hasTest = cfg.framework === "pytest" ? /^\s*(async\s+)?def test_\w+\s*\(/m.test(o.code) : /\b(test|it)(\.each\([^)]*\))?\s*\(/.test(o.code);
  if (!hasTest) throw new InvalidModelOutput("The draft defines no test");
  if (!balanced(o.code)) throw new InvalidModelOutput("The draft has unbalanced brackets");
  return { path: norm, code: o.code };
}
