import type { ReactNode } from "react";

/**
 * The frame every insight chart sits in: a titled card with an optional headline figure,
 * the visual (hidden from assistive tech) and the same numbers as a screen-reader table.
 */
export function ChartFrame({
  id,
  title,
  sub,
  figure,
  table,
  children,
  className = "",
}: {
  id: string;
  title: string;
  sub?: ReactNode;
  figure?: ReactNode;
  table: { caption: string; columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-h`}
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-s1 shadow-e1 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={`${id}-h`} className="m-0 text-ui font-semibold text-fg">
            {title}
          </h2>
          {sub && <p className="m-0 text-callout text-fg-3">{sub}</p>}
        </div>
        {figure}
      </div>
      <div aria-hidden="true" className="flex-1 px-5 pb-5 pt-4">
        {children}
      </div>
      <div className="sr-only">
        <table>
          <caption>{table.caption}</caption>
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, n) => (
              <tr key={n}>
                {r.map((v, i) =>
                  i === 0 ? (
                    <th key={i} scope="row">
                      {v}
                    </th>
                  ) : (
                    <td key={i}>{v}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Fixed series colours: each one is a verdict colour or neutral, never a palette rotation. */
export const SERIES = {
  opened: { bar: "bg-fg-3", text: "text-fg-2" },
  proven: { bar: "bg-proven", text: "text-proven" },
  blocked: { bar: "bg-recur", text: "text-recur" },
  safe: { bar: "bg-safe", text: "text-safe" },
  inconclusive: { bar: "bg-inconclusive", text: "text-inconclusive" },
  flaky: { bar: "bg-flaky", text: "text-flaky" },
  neutral: { bar: "bg-border-strong", text: "text-fg-3" },
} as const;
export type Series = keyof typeof SERIES;

/**
 * A 100% bar split into parts, each labelled directly underneath with its name and count (no legend).
 * Empty parts keep their label so the reader sees the zero.
 */
export function SplitBar({
  parts,
}: {
  parts: { label: string; value: number; series: Series }[];
}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-s2">
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <span
                key={p.label}
                className={`h-full ${SERIES[p.series].bar}`}
                style={{ width: `${(p.value / total) * 100}%` }}
              />
            ))}
      </div>
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-x-4 gap-y-2">
        {parts.map((p) => (
          <div key={p.label} className="flex min-w-0 flex-col">
            <dt className="flex items-center gap-1.5 text-caption text-fg-3">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${SERIES[p.series].bar}`}
              />
              {p.label}
            </dt>
            <dd className="m-0 text-title-3 font-semibold tabular-nums text-fg">
              {p.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
