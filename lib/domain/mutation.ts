import { structuredPatch } from "diff";

export type Mutant = { file: string; line: number; from: string; to: string; content: string };
export type MutantResult = { file: string; line: number; from: string; to: string; killed: boolean };
export type Strength = { killed: number; total: number; score: number; survivors: { file: string; line: number; from: string; to: string }[]; checkedAt?: string };

export const MAX_MUTANTS_PER_FILE = 8;

/** Small, classic mutation operators. Each applies to the first match on a line. */
const OPS: [RegExp, (m: string) => string][] = [
  [/<=/, () => "<"],
  [/>=/, () => ">"],
  [/(?<![<=!-])<(?![<=])/, () => "<="],
  [/(?<![>=-])>(?![>=])/, () => ">="],
  [/===/, () => "!=="],
  [/!==/, () => "==="],
  [/(?<![=!<>])==(?!=)/, () => "!="],
  [/!=(?!=)/, () => "=="],
  [/ not in /, () => " in "],
  [/(?<!not) in (?=\S)/, () => " not in "],
  [/ and /, () => " or "],
  [/ or /, () => " and "],
  [/&&/, () => "||"],
  [/\|\|/, () => "&&"],
  [/\bTrue\b/, () => "False"],
  [/\bFalse\b/, () => "True"],
  [/\btrue\b/, () => "false"],
  [/\bfalse\b/, () => "true"],
  [/ \+ /, () => " - "],
  [/ - /, () => " + "],
  [/(?<![\w.])(\d+)(?![\w.])/, (m) => String(Number(m) + 1)],
];

const SKIP = /^\s*($|#|\/\/|\/\*|\*|import\b|from\s+\S+\s+import\b|package\b|using\b|require\b|@)/;

/**
 * Mutants of the fixed version of a file, limited to the lines the fix added: if the proven test still
 * passes with one of these small changes, it doesn't pin down the behaviour the fix introduced.
 */
export function mutantsFor(file: string, parent: string, fix: string): Mutant[] {
  const patch = structuredPatch(file, file, parent, fix, undefined, undefined, { context: 0 });
  const added: number[] = [];
  for (const h of patch.hunks) {
    let n = h.newStart;
    for (const l of h.lines) {
      if (l.startsWith("+")) added.push(n++);
      else if (!l.startsWith("-")) n++;
    }
  }
  const lines = fix.split("\n");
  const out: Mutant[] = [];
  const seen = new Set<string>();
  for (const ln of added) {
    const from = lines[ln - 1];
    if (from === undefined || SKIP.test(from) || /^\s*["'`]/.test(from)) continue;
    const code = from.replace(/(#|\/\/).*$/, "");
    for (const [re, rep] of OPS) {
      const m = code.match(re);
      if (!m || m.index === undefined) continue;
      const to = from.slice(0, m.index) + (m[1] !== undefined && re.source.includes("(\\d+)") ? rep(m[1]) : rep(m[0])) + from.slice(m.index + m[0].length);
      if (to === from || seen.has(`${ln}:${to}`)) continue;
      seen.add(`${ln}:${to}`);
      const content = [...lines.slice(0, ln - 1), to, ...lines.slice(ln)].join("\n");
      out.push({ file, line: ln, from, to, content });
      if (out.length >= MAX_MUTANTS_PER_FILE) return out;
    }
  }
  return out;
}

export function strengthOf(results: MutantResult[]): Strength {
  const killed = results.filter((r) => r.killed).length;
  return { killed, total: results.length, score: results.length ? Math.round((killed / results.length) * 100) : 0, survivors: results.filter((r) => !r.killed).map(({ file, line, from, to }) => ({ file, line, from, to })) };
}
