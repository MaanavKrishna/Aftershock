import type { RunResult } from "@/lib/domain/verdict";

export type Cell = "fail" | "pass" | "none" | "running";
const COLOR: Record<Cell, string> = { fail: "bg-recur", pass: "bg-proven", none: "bg-s3", running: "bg-fg-3" };

/** Run results as a row of cells: recur colour failed, proven colour passed, neutral not run. Always labelled. */
export function Strip({ cells, height = 10, width, label }: { cells: Cell[]; height?: number; width?: number; label?: string }) {
  return (
    <span className="flex gap-0.5" style={{ width }} role="img" aria-label={label ?? cells.join(", ")}>
      {cells.map((c, i) => (
        <span key={i} className={`flex-1 rounded-xs ${COLOR[c]}`} style={{ height }} />
      ))}
    </span>
  );
}

export const toCells = (runs: RunResult[], n = runs.length): Cell[] =>
  Array.from({ length: n }, (_, i) => {
    const r = runs[i];
    if (!r) return "none";
    return r.outcome === "passed" ? "pass" : r.outcome === "failed" ? "fail" : "running";
  });
