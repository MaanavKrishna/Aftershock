import type { Insights } from "@/lib/domain/insights";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[14px] border border-line bg-card px-5 py-4">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="font-mono text-[28px] font-semibold tracking-[-0.02em]">{value}</span>
      {sub && <span className="text-[12px] text-muted-2">{sub}</span>}
    </div>
  );
}

/** Reliability numbers; used in the app and on the public read-only report (where files are hidden). */
export function InsightsView({ i, showFiles = true }: { i: Insights; showFiles?: boolean }) {
  const max = Math.max(1, ...i.weeks.flatMap((w) => [w.opened, w.proven, w.blocked]));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-3">
        <Stat label="Incidents proven" value={`${i.incidents.proven}`} sub={`of ${i.incidents.total} · ${i.proofRate}% of attempts proven`} />
        <Stat label="Median time to proof" value={i.medianHoursToProof === null ? "—" : `${i.medianHoursToProof} h`} sub="from incident opened to test proven" />
        <Stat label="Recurrences blocked" value={`${i.recurrencesBlocked}`} sub={`${i.overridden} overridden by a person`} />
        <Stat label="Memory tests" value={`${i.tests.total}`} sub={`${i.tests.healthy} healthy · ${i.tests.flaky} flaky · ${i.tests.failing} failing`} />
        <Stat label="Still guarding" value={`${i.tests.guarding}`} sub={`${i.tests.weak} weak · ${i.tests.drifted} drifted`} />
        <Stat label="Average test strength" value={i.tests.avgStrength === null ? "—" : `${i.tests.avgStrength}%`} sub="small changes to fixes that tests catch" />
      </div>
      <section className="rounded-[14px] border border-line bg-card px-5 py-4" aria-labelledby="weeks-h">
        <h2 id="weeks-h" className="m-0 mb-3 text-base font-semibold">Last 8 weeks</h2>
        <div className="flex items-end gap-2 overflow-x-auto pb-1" role="img" aria-label={i.weeks.map((w) => `week of ${w.weekStart}: ${w.opened} opened, ${w.proven} proven, ${w.blocked} blocked`).join("; ")}>
          {i.weeks.map((w) => (
            <div key={w.weekStart} className="flex min-w-[56px] flex-1 flex-col items-center gap-1.5">
              <div className="flex h-[120px] items-end gap-1">
                <span className="w-3 rounded-t bg-muted-2" style={{ height: `${(w.opened / max) * 100}%` }} title={`${w.opened} opened`} />
                <span className="w-3 rounded-t bg-pass" style={{ height: `${(w.proven / max) * 100}%` }} title={`${w.proven} proven`} />
                <span className="w-3 rounded-t bg-fail" style={{ height: `${(w.blocked / max) * 100}%` }} title={`${w.blocked} blocked`} />
              </div>
              <span className="font-mono text-[11px] text-muted-2">{w.weekStart.slice(5)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted-2" />opened</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-pass" />proven</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-fail" />recurrences blocked</span>
        </div>
      </section>
      <div className="flex flex-wrap gap-4">
        <section className="min-w-0 flex-[1_1_320px] rounded-[14px] border border-line bg-card px-5 py-4" aria-labelledby="checks-h">
          <h2 id="checks-h" className="m-0 mb-2 text-base font-semibold">Pull request checks</h2>
          {[["Recur", i.checks.recur], ["Safe", i.checks.safe], ["Inconclusive", i.checks.inconclusive], ["Skipped", i.checks.skipped]].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between border-b border-line-soft py-2 text-[13.5px] last:border-b-0"><span>{k}</span><span className="font-mono">{v}</span></div>
          ))}
        </section>
        {showFiles && (
          <section className="min-w-0 flex-[1_1_320px] rounded-[14px] border border-line bg-card px-5 py-4" aria-labelledby="faults-h">
            <h2 id="faults-h" className="m-0 mb-2 text-base font-semibold">Fault lines</h2>
            {i.faultLines.length === 0 && <p className="m-0 text-[13px] text-muted">No files behind more than one incident yet.</p>}
            {i.faultLines.map((f) => (
              <div key={f.file} className="flex justify-between gap-3 border-b border-line-soft py-2 text-[13px] last:border-b-0"><span className="truncate font-mono">{f.file}</span><span className="font-mono">{f.count} incident{f.count === 1 ? "" : "s"}</span></div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
