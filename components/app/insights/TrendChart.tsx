import type { Insights } from "@/lib/domain/insights";
import { ChartFrame, SERIES, type Series } from "./ChartFrame";

const ROWS: { key: "opened" | "proven" | "blocked"; label: string; series: Series }[] = [
  { key: "opened", label: "Incidents opened", series: "opened" },
  { key: "proven", label: "Proven", series: "proven" },
  { key: "blocked", label: "Recurrences blocked", series: "blocked" },
];

const short = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}`;
};

/**
 * Eight weeks as small multiples: one row per series on a shared scale, each labelled directly
 * with its name and total. Drawn once; nothing moves afterwards.
 */
export function TrendChart({ weeks }: { weeks: Insights["weeks"] }) {
  const max = Math.max(1, ...weeks.flatMap((w) => [w.opened, w.proven, w.blocked]));
  const total = (k: (typeof ROWS)[number]["key"]) => weeks.reduce((a, w) => a + w[k], 0);
  const cols = { gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` };
  return (
    <ChartFrame
      id="trend"
      title="Last 8 weeks"
      sub="Incidents opened, tests proven and recurrences blocked, per week."
      table={{ caption: "Last 8 weeks, per week", columns: ["Week of", ...ROWS.map((r) => r.label)], rows: weeks.map((w) => [w.weekStart, w.opened, w.proven, w.blocked]) }}
    >
      <div className="flex flex-col gap-4">
        {ROWS.map((r) => (
          <div key={r.key} className="grid gap-x-4 gap-y-2 sm:grid-cols-[148px_minmax(0,1fr)]">
            <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:justify-end sm:gap-0 sm:pb-1">
              <span className="text-callout text-fg-2">{r.label}</span>
              <span className={`text-title-3 font-semibold tabular-nums ${SERIES[r.series].text}`}>{total(r.key)}</span>
            </div>
            <div className="relative pt-5">
              <div className="relative grid h-14 gap-1.5 border-b border-border-strong" style={cols}>
                <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
                <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border-soft" />
                {weeks.map((w) => {
                  const v = w[r.key];
                  return (
                    <span key={w.weekStart} className="relative flex h-full items-end justify-center">
                      <span className={`relative w-full max-w-7 rounded-t-sm ${v > 0 ? SERIES[r.series].bar : "bg-border"}`} style={{ height: v > 0 ? `max(4px, ${(v / max) * 100}%)` : "2px" }}>
                        {v > 0 && <span className="absolute inset-x-0 bottom-full pb-0.5 text-center text-caption tabular-nums text-fg-2">{v}</span>}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        <div className="grid gap-x-4 sm:grid-cols-[148px_minmax(0,1fr)]">
          <span className="hidden text-caption text-fg-3 sm:block">Week of</span>
          <div className="grid gap-1.5" style={cols}>
            {weeks.map((w, i) => (
              <span key={w.weekStart} className={`whitespace-nowrap text-center text-caption tabular-nums text-fg-3 ${i % 2 ? "max-sm:invisible" : ""}`}>
                {short(w.weekStart)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ChartFrame>
  );
}
