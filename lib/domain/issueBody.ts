type Field = "trigger" | "observed" | "expected";

const KINDS: [RegExp, Field][] = [
  [/^(trigger|steps to reproduce|reproduction|repro|how to reproduce)\b/i, "trigger"],
  [/^expected\b/i, "expected"],
  [/^(observed|actual|what happened|impact|symptoms?)\b/i, "observed"],
];

/** A section label on its own line: "## Trigger", "**Trigger**", or "Trigger: text". */
function header(line: string): { field: Field; rest: string } | null {
  const m = line.match(/^\s*(?:#{1,6}\s+(.+?)\s*#*\s*$|\*\*(.+?):?\*\*\s*:?\s*(.*)$|([A-Za-z][A-Za-z ]{2,30}):\s*(.*)$)/);
  if (!m) return null;
  const label = (m[1] ?? m[2] ?? m[4] ?? "").trim();
  const kind = KINDS.find(([re]) => re.test(label));
  return kind ? { field: kind[1], rest: (m[3] ?? m[5] ?? "").trim() } : null;
}

/** Splits an incident issue body into trigger, observed and expected. Unlabelled text counts as observed. */
export function fieldsFromIssue(body: string): { trigger: string; observed: string; expected: string } {
  const sections: Record<Field, string[][]> = { trigger: [], observed: [], expected: [] };
  let current: string[] = [];
  sections.observed.push(current);
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const h = header(line);
    if (h) {
      current = h.rest ? [h.rest] : [];
      sections[h.field].push(current);
    } else {
      current.push(line);
    }
  }
  const join = (f: Field) => sections[f].map((s) => s.join("\n").trim()).filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n");
  return { trigger: join("trigger"), observed: join("observed"), expected: join("expected") };
}
