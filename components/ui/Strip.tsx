import type { RunResult } from "@/lib/domain/verdict";

export type Cell = "fail" | "pass" | "none" | "running";
const COLOR: Record<Cell, string> = { fail: "bg-fail", pass: "bg-pass", none: "bg-line", running: "bg-[#9AA1A9]" };

export function Strip({ cells, height = 10, width, label }: { cells: Cell[]; height?: number; width?: number; label?: string }) {
  return (
    <span className="flex gap-0.5" style={{ width }} role="img" aria-label={label ?? cells.join(", ")}>
      {cells.map((c, i) => (
        <span key={i} className={`flex-1 rounded-[2px] ${COLOR[c]}`} style={{ height }} />
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
