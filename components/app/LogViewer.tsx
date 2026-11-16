"use client";
import { useId, useMemo, useState } from "react";
import { CopyText } from "@/components/ui/CopyText";
import { Search } from "@/components/ui/icons";

const FAILURE = /\b(FAILED|FAIL|Error|Exception|assert|AssertionError|Traceback|panic|expected|✕)\b/;

/** Run output on a sunken mono surface: line numbers, a filter, failures marked, and a "failures only" switch. */
export function LogViewer({ log }: { log: string }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [onlyFailures, setOnlyFailures] = useState(false);
  const lines = useMemo(() => log.split("\n").slice(0, 4000).map((text, i) => ({ n: i + 1, text, bad: FAILURE.test(text) })), [log]);
  const failures = lines.filter((l) => l.bad).length;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return lines.filter((l) => (!onlyFailures || l.bad) && (!t || l.text.toLowerCase().includes(t)));
  }, [lines, q, onlyFailures]);
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <label htmlFor={id} className="sr-only">
          Filter the output
        </label>
        <span className="relative flex min-w-40 flex-1 items-center">
          <span className="pointer-events-none absolute left-2.5 text-fg-3">
            <Search size={14} />
          </span>
          <input
            id={id}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter lines"
            className="min-h-8 w-full rounded-chip border border-field bg-s1 pl-8 pr-2.5 text-callout text-fg placeholder:text-fg-3 focus-visible:border-signal focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal-soft"
          />
        </span>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 rounded-chip px-1.5 text-callout text-fg-2">
          <input type="checkbox" checked={onlyFailures} onChange={(e) => setOnlyFailures(e.target.checked)} className="h-4 w-4 accent-signal" />
          Failures only <span className="tabular-nums text-fg-3">{failures}</span>
        </label>
        <CopyText text={log} />
      </div>
      <pre tabIndex={0} aria-label="Sandbox output" className="m-0 max-h-[520px] overflow-auto bg-sunken py-3 font-mono text-caption leading-relaxed text-fg-2">
        {shown.map((l) => (
          <span key={l.n} className={`flex gap-4 px-4 ${l.bad ? "bg-recur-soft text-recur" : ""}`}>
            <span className="w-9 shrink-0 select-none text-right tabular-nums text-fg-3" aria-hidden="true">
              {l.n}
            </span>
            <span className="whitespace-pre">{l.text || " "}</span>
          </span>
        ))}
        {shown.length === 0 && <span className="block px-4 text-fg-3">No lines match.</span>}
      </pre>
      <span className="sr-only" aria-live="polite">{`${shown.length} of ${lines.length} lines shown`}</span>
    </div>
  );
}
