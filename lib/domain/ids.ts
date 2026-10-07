export function incidentKey(prefix: string, n: number): string {
  return `${prefix}-${n}`;
}

export function parseIncidentRefs(text: string, prefix: string): number[] {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![A-Za-z0-9])${escaped}-(\\d+)\\b`, "gi");
  const out: number[] = [];
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
