"use client";
import { useId, useState } from "react";

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(1).replace(/\.0$/, ""));

/** What repeat incidents cost you, from your own numbers. The defaults are placeholders, not benchmarks. */
export function CostCalculator() {
  const id = useId();
  const [v, setV] = useState({ incidents: 12, recurPct: 15, hours: 16, rate: 120 });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Math.max(0, Number(e.target.value) || 0) });
  const recurrences = v.incidents * 4 * (v.recurPct / 100);
  const hours = recurrences * v.hours;
  const cost = hours * v.rate;
  const fields: [keyof typeof v, string, string, number][] = [
    ["incidents", "Incidents per quarter", "", 1],
    ["recurPct", "Share that come back", "%", 1],
    ["hours", "Engineer hours per incident", "h", 1],
    ["rate", "Loaded hourly cost", "$", 5],
  ];
  return (
    <div className="grid overflow-hidden rounded-stage border border-border bg-canvas shadow-e1 md:grid-cols-[1.15fr_1fr]">
      <div className="grid gap-5 p-6 sm:grid-cols-2 md:p-8">
        {fields.map(([k, label, unit, step]) => (
          <label key={k} htmlFor={`${id}-${k}`} className="flex flex-col gap-2 text-callout font-medium text-fg-2">
            {label}
            <span className="flex min-h-11 items-center gap-2 rounded-control border border-field bg-s1 px-3 transition-colors duration-150 focus-within:border-signal">
              {unit === "$" && <span className="text-fg-3">$</span>}
              <input id={`${id}-${k}`} type="number" inputMode="decimal" min={0} step={step} value={v[k]} onChange={set(k)} className="w-full min-w-0 border-0 bg-transparent font-mono text-body tabular-nums text-fg outline-none" />
              {unit && unit !== "$" && <span className="text-fg-3">{unit}</span>}
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-col justify-center gap-2 border-t border-border bg-sunken p-6 md:border-l md:border-t-0 md:p-8" aria-live="polite">
        <span className="text-callout text-fg-3">Repeat incidents a year</span>
        <span className="text-display-2 font-semibold tabular-nums text-fg">{fmt(recurrences)}</span>
        <span className="text-body text-fg-2">
          {fmt(hours)} engineer hours, about <strong className="font-semibold text-fg">${fmt(cost)}</strong>, spent on bugs you already fixed once.
        </span>
        <span className="pt-3 text-caption text-fg-3">Every default is a placeholder. Put in your own numbers; nothing here is sent anywhere.</span>
      </div>
    </div>
  );
}
