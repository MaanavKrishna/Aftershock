"use client";
import * as m from "motion/react-m";

type R = { outcome: string } | undefined;

/** The three runs on one commit; each cell flips over when its result lands. */
export function RunCells({ runs }: { runs: R[] }) {
  return (
    <div className="flex gap-2" style={{ perspective: 600 }}>
      {[0, 1, 2].map((i) => {
        const r = runs[i];
        const cls = !r ? "border border-dashed border-ink-line text-on-dark-muted" : r.outcome === "failed" ? "border-[1.5px] border-fail-dark text-fail-dark" : r.outcome === "passed" ? "bg-pass-dark text-chrome" : "border-[1.5px] border-dashed border-on-dark-muted text-on-dark-muted";
        return (
          <m.span key={`${i}-${r?.outcome ?? "pending"}`} initial={r ? { rotateX: -90, opacity: 0.4 } : false} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.35, delay: i * 0.12 }} className={`flex flex-1 flex-col gap-0.5 rounded-lg px-3 py-2.5 ${cls}`}>
            <span className="font-mono text-[11.5px]">run {i + 1}</span>
            <span className="text-[13px] font-semibold">{r ? (r.outcome === "failed" ? "✕ failed" : r.outcome === "passed" ? "✓ passed" : "◐ error") : "pending"}</span>
          </m.span>
        );
      })}
    </div>
  );
}
