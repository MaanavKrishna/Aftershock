"use client";
import { useState } from "react";

export function HeroCard() {
  const [drop, setDrop] = useState(true);
  const seg = (on: boolean) => `min-h-8 cursor-pointer rounded-md border-0 px-3 text-[12.5px] font-semibold ${on ? "bg-on-dark text-ink" : "bg-transparent text-on-dark-muted"}`;
  return (
    <div className="min-w-0 flex-[1_1_500px] overflow-hidden rounded-[14px] bg-ink text-on-dark shadow-[0_30px_60px_-30px_rgba(14,20,27,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-line px-[18px] py-3.5">
        <div className="font-mono text-[13px] text-on-dark-muted">INC-12 / <span className="text-on-dark">payment retry charged twice</span></div>
        <div role="group" aria-label="Pull request under check" className="flex rounded-lg border border-ink-line bg-ink-2 p-[3px]">
          <button type="button" onClick={() => setDrop(false)} aria-pressed={!drop} className={seg(!drop)}>PR keeps guard</button>
          <button type="button" onClick={() => setDrop(true)} aria-pressed={drop} className={seg(drop)}>PR drops guard</button>
        </div>
      </div>
      <div className="px-[18px] pb-1.5 pt-[22px] font-mono text-[13px]">
        {[
          { dot: "h-3 w-3 rounded-full border-2 border-fail-dark", sha: "3f2a1c9", label: "before the fix", tag: "test fails ✕", tagCls: "text-fail-dark", sub: "retry → 201 · 2 payment rows · reproduces the incident" },
          { dot: "h-3 w-3 rounded-full bg-pass-dark", sha: "aa86f56", label: "fix: reject duplicate pending payment", tag: "test passes ✓", tagCls: "text-pass-dark", sub: "retry → 400 · 1 payment row · admitted to memory" },
          { dot: `h-3 w-3 rounded-[3px] ${drop ? "bg-fail-dark" : "bg-pass-dark"}`, sha: "PR #214", label: "refactor: simplify payment service", tag: drop ? "blocked ✕" : "passes ✓", tagCls: drop ? "text-fail-dark" : "text-pass-dark", sub: drop ? "pending-payment check deleted · retry → 201 · 2 rows" : "guard moved, behaviour kept · retry → 400 · 1 row", last: true },
        ].map((r) => (
          <div key={r.sha} className="flex gap-3.5 pb-3.5">
            <span className="flex w-4 shrink-0 flex-col items-center"><span className={`mt-[3px] ${r.dot}`} />{!r.last && <span className="min-h-7 w-0.5 flex-1 bg-ink-line" />}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <div className="flex flex-wrap justify-between gap-2.5"><span><span className="text-[#7D8896]">{r.sha}</span> {r.label}</span><span className={`font-semibold ${r.tagCls}`}>{r.tag}</span></div>
              <span className="text-[#8792A0]">{r.sub}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mx-[18px] mb-[18px] mt-3.5 flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-[10px] border border-ink-line bg-ink-2 px-[18px] py-4" aria-live="polite">
        <span className={`rounded-md px-2.5 py-1.5 font-mono text-[13px] font-semibold ${drop ? "bg-fail-dark text-ink" : "bg-pass text-white"}`}>{drop ? "RECUR" : "SAFE"}</span>
        <div className="min-w-0 flex-[1_1_220px]">
          <div className="font-semibold text-white">{drop ? "PR #214 would ship INC-12 again. The check blocks the merge." : "PR #214 keeps the lesson. The check passes."}</div>
          <div className="text-[13px] text-on-dark-muted">Admission rule: fails before the fix, passes on the fix</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 border-t border-ink-line px-[18px] py-3 font-mono text-xs text-muted-2"><span>pytest</span><span>isolated sandbox per run</span><span>3 runs per commit</span></div>
    </div>
  );
}
