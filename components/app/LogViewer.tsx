"use client";
import { useId, useMemo, useState } from "react";
import { CopyText } from "@/components/ds/CopyText";

const FAILURE = /\b(FAILED|FAIL|Error|Exception|assert|AssertionError|Traceback|panic|expected|✕)\b/;

/** Run output with line numbers, a filter, failures highlighted and a "failures only" switch. */
export function LogViewer({ log }: { log: string }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [onlyFailures, setOnlyFailures] = useState(false);
  const lines = useMemo(() => log.split("\n").slice(0, 4000).map((text, i) => ({ n: i + 1, text, bad: FAILURE.test(text) })), [log]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return lines.filter((l) => (!onlyFailures || l.bad) && (!t || l.text.toLowerCase().includes(t)));
  }, [lines, q, onlyFailures]);
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#222C38] px-[22px] py-3">
        <label htmlFor={id} className="sr-only">Filter the output</label>
        <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter lines" className="min-h-9 min-w-0 flex-1 rounded-md border border-[#2E3A48] bg-[#141B24] px-2.5 text-[13px] text-on-dark outline-none focus:border-pass-dark" />
        <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[12.5px] text-on-dark-muted"><input type="checkbox" checked={onlyFailures} onChange={(e) => setOnlyFailures(e.target.checked)} className="h-4 w-4 accent-[#7DD3FC]" />Failures only</label>
        <span className="[&_button]:border-[#2E3A48] [&_button]:text-on-dark-muted"><CopyText text={log} /></span>
      </div>
      <pre tabIndex={0} aria-label="Sandbox output" className="m-0 max-h-[520px] overflow-auto py-3 font-mono text-xs leading-[1.75] text-on-dark-muted">
        {shown.map((l) => (
          <span key={l.n} className={`flex gap-4 px-[22px] ${l.bad ? "bg-[rgba(251,138,76,0.1)] text-[#FFC9AC]" : ""}`}>
            <span className="w-9 shrink-0 select-none text-right text-on-dark-muted/60" aria-hidden="true">{l.n}</span>
            <span className="whitespace-pre">{l.text || " "}</span>
          </span>
        ))}
        {shown.length === 0 && <span className="block px-[22px] text-on-dark-muted">No lines match.</span>}
      </pre>
      <span className="sr-only" aria-live="polite">{`${shown.length} of ${lines.length} lines shown`}</span>
    </div>
  );
}
