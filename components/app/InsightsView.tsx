import type { Insights } from "@/lib/domain/insights";
import { Verdict, type VerdictKind } from "@/components/ui/Verdict";
import { ChartFrame, SERIES, SplitBar, type Series } from "./insights/ChartFrame";
import { TrendChart } from "./insights/TrendChart";

const CHECK_ROWS: [VerdictKind, Series, "recur" | "safe" | "inconclusive" | "skipped"][] = [
  ["recur", "blocked", "recur"],
  ["safe", "safe", "safe"],
  ["inconclusive", "inconclusive", "inconclusive"],
  ["skipped", "neutral", "skipped"],
];

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "proven" | "recur" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-s1 px-5 py-4">
      <dt className="text-callout text-fg-3">{label}</dt>
      <dd className={`m-0 text-title-1 font-semibold tabular-nums ${tone === "proven" ? "text-proven" : tone === "recur" ? "text-recur" : "text-fg"}`}>{value}</dd>
      {sub && <dd className="m-0 text-caption text-fg-3">{sub}</dd>}
    </div>
  );
}

/** Reliability numbers; used in the app and on the public read-only report (where files are hidden). */
export function InsightsView({ i, showFiles = true }: { i: Insights; showFiles?: boolean }) {
  const t = i.tests;
  const c = i.checks;
  const maxFault = Math.max(1, ...i.faultLines.map((f) => f.count));
  return (
    <div className="flex flex-col gap-4">
      <dl className="m-0 grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border bg-border shadow-e1 min-[480px]:grid-cols-2 lg:grid-cols-3">
        <Tile label="Incidents proven" value={`${i.incidents.proven}`} sub={`of ${i.incidents.total} · ${i.proofRate}% of attempts proven`} tone={i.incidents.proven > 0 ? "proven" : undefined} />
        <Tile label="Median time to proof" value={i.medianHoursToProof === null ? "—" : `${i.medianHoursToProof} h`} sub="From incident opened to test proven" />
        <Tile label="Recurrences blocked" value={`${i.recurrencesBlocked}`} sub={`${i.overridden} overridden by a person`} />
        <Tile label="Memory tests" value={`${t.total}`} sub={`${t.healthy} healthy · ${t.flaky} flaky · ${t.failing} failing`} />
        <Tile label="Still guarding" value={`${t.guarding}`} sub={`${t.weak} weak · ${t.drifted} drifted`} />
        <Tile label="Average test strength" value={t.avgStrength === null ? "—" : `${t.avgStrength}%`} sub="Small changes to fixes that tests catch" />
      </dl>

      <TrendChart weeks={i.weeks} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          id="health"
          title="Test health"
          sub="How the memory suite behaved on its latest runs."
          table={{
            caption: "Memory test health and guard status",
            columns: ["State", "Tests"],
            rows: [
              ["Healthy", t.healthy],
              ["Flaky", t.flaky],
              ["Failing", t.failing],
              ["Still guarding", t.guarding],
              ["Weak", t.weak],
              ["Drifted", t.drifted],
              ["Average strength", t.avgStrength === null ? "none yet" : `${t.avgStrength}%`],
            ],
          }}
        >
          <div className="flex flex-col gap-6">
            <SplitBar
              parts={[
                { label: "Healthy", value: t.healthy, series: "proven" },
                { label: "Flaky", value: t.flaky, series: "flaky" },
                { label: "Failing", value: t.failing, series: "blocked" },
              ]}
            />
            <SplitBar
              parts={[
                { label: "Still guarding", value: t.guarding, series: "proven" },
                { label: "Weak", value: t.weak, series: "inconclusive" },
                { label: "Drifted", value: t.drifted, series: "flaky" },
              ]}
            />
            <div className="flex flex-col gap-2 border-t border-border-soft pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-callout text-fg-2">Average strength</span>
                <span className="text-title-3 font-semibold tabular-nums text-fg">{t.avgStrength === null ? "—" : `${t.avgStrength}%`}</span>
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-s2">
                <span className="absolute inset-y-0 left-0 rounded-full bg-fg-2" style={{ width: `${t.avgStrength ?? 0}%` }} />
                {[25, 50, 75].map((x) => (
                  <span key={x} className="absolute inset-y-0 w-px bg-s1" style={{ left: `${x}%` }} />
                ))}
              </div>
              <span className="text-caption text-fg-3">Share of small changes to each fix that its test catches.</span>
            </div>
          </div>
        </ChartFrame>

        <ChartFrame
          id="checks"
          title="Pull request checks"
          sub={`${c.total} check${c.total === 1 ? "" : "s"} against the memory suite.`}
          table={{ caption: "Pull request checks by verdict", columns: ["Verdict", "Checks"], rows: [["Recur", c.recur], ["Safe", c.safe], ["Inconclusive", c.inconclusive], ["Skipped", c.skipped]] }}
        >
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {CHECK_ROWS.map(([kind, series, key]) => {
              const v = c[key];
              const max = Math.max(1, c.recur, c.safe, c.inconclusive, c.skipped);
              return (
                <li key={kind} className="grid grid-cols-[112px_minmax(0,1fr)_32px] items-center gap-3">
                  <Verdict kind={kind} size="sm" />
                  <span className="h-2 overflow-hidden rounded-full bg-s2">
                    <span className={`block h-full rounded-full ${SERIES[series].bar}`} style={{ width: `${(v / max) * 100}%` }} />
                  </span>
                  <span className="text-right text-ui font-semibold tabular-nums text-fg">{v}</span>
                </li>
              );
            })}
          </ul>
          <p className="m-0 mt-5 border-t border-border-soft pt-4 text-caption text-fg-3">
            {i.recurrencesBlocked} merge{i.recurrencesBlocked === 1 ? "" : "s"} stopped by a Recur verdict; {i.overridden} overridden by a person.
          </p>
        </ChartFrame>
      </div>

      {showFiles && (
        <section aria-labelledby="faults-h" className="flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-s1 shadow-e1">
          <div className="flex flex-col gap-0.5 border-b border-border-soft px-5 py-4">
            <h2 id="faults-h" className="m-0 text-ui font-semibold text-fg">
              Fault lines
            </h2>
            <p className="m-0 text-callout text-fg-3">Files behind more than one incident. The places your codebase keeps breaking.</p>
          </div>
          {i.faultLines.length === 0 ? (
            <p className="m-0 px-5 py-6 text-ui text-fg-3">No files behind more than one incident yet.</p>
          ) : (
            <ol className="m-0 list-none p-0">
              {i.faultLines.map((f) => (
                <li key={f.file} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-border-soft px-5 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)_88px]">
                  <span className="truncate font-mono text-callout text-fg" title={f.file}>
                    {f.file}
                  </span>
                  <span aria-hidden="true" className="col-span-2 row-start-2 h-1.5 overflow-hidden rounded-full bg-s2 sm:col-span-1 sm:row-start-1 sm:col-start-2">
                    <span className="block h-full rounded-full bg-fg-3" style={{ width: `${(f.count / maxFault) * 100}%` }} />
                  </span>
                  <span className="text-right text-callout tabular-nums text-fg-2">
                    {f.count} incident{f.count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
