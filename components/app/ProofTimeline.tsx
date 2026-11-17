"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import * as m from "motion/react-m";
import { Bolt, Check, Commit, Cross, Dashed } from "@/components/ui/icons";
import { SNAPPY } from "@/lib/motion";
import { duration } from "@/lib/format";
import { RunCells } from "./RunCells";

type Run = { outcome: "passed" | "failed" | "error"; durationMs: number; message?: string };
type Lane = { sha: string; title: string; runs: Run[]; must: "fail" | "pass" };

export type ProofTimelineProps = {
  incident: { key: string; opened: string; source: string; observed: string };
  before: Lane;
  fix: Lane;
  /** Shown under the timeline: which attempt this is, and where to see the whole run. */
  footer?: ReactNode;
};

type Tone = "recur" | "proven" | "neutral" | "pending";
function laneTone(l: Lane): Tone {
  if (l.runs.length === 0) return "pending";
  const want = l.must === "fail" ? "failed" : "passed";
  if (l.runs.every((r) => r.outcome === want)) return l.must === "fail" ? "recur" : "proven";
  return "neutral";
}
function laneSummary(l: Lane) {
  if (l.runs.length === 0) return "Not run yet";
  const failed = l.runs.filter((r) => r.outcome === "failed").length;
  const passed = l.runs.filter((r) => r.outcome === "passed").length;
  return l.must === "fail" ? `${failed}/${l.runs.length} failed` : `${passed}/${l.runs.length} passed`;
}

const DOT: Record<Tone, string> = {
  recur: "bg-recur text-canvas",
  proven: "bg-proven text-canvas",
  neutral: "bg-s3 text-fg-2",
  pending: "border border-dashed border-border-strong bg-s1 text-fg-3",
};

/**
 * The proof as a timeline: the incident, then the commit before the fix (the test must fail), then the fix
 * (it must pass). Each step is a tab; arrow keys, Home and End move between them.
 */
export function ProofTimeline({ incident, before, fix, footer }: ProofTimelineProps) {
  const id = useId();
  const [sel, setSel] = useState(1);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const steps = [
    { label: "Incident", sub: incident.key, meta: incident.opened, tone: "neutral" as Tone, icon: <Bolt size={13} /> },
    { label: "Before the fix", sub: before.sha, meta: laneSummary(before), tone: laneTone(before), icon: laneTone(before) === "recur" ? <Cross size={13} /> : laneTone(before) === "pending" ? <Dashed size={13} /> : <Commit size={13} /> },
    { label: "On the fix", sub: fix.sha, meta: laneSummary(fix), tone: laneTone(fix), icon: laneTone(fix) === "proven" ? <Check size={13} /> : laneTone(fix) === "pending" ? <Dashed size={13} /> : <Commit size={13} /> },
  ];
  const move = (e: KeyboardEvent, i: number) => {
    const last = steps.length - 1;
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (to === null) return;
    e.preventDefault();
    setSel(to);
    tabs.current[to]?.focus();
  };
  const lane = sel === 1 ? before : sel === 2 ? fix : null;
  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label="Proof timeline" aria-orientation="horizontal" className="relative grid grid-cols-1 gap-1 p-2 sm:grid-cols-3">
        {steps.map((s, i) => {
          const on = sel === i;
          return (
            <button
              key={s.label}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={on}
              aria-controls={`${id}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setSel(i)}
              onKeyDown={(e) => move(e, i)}
              className="group relative flex min-w-0 cursor-pointer items-start gap-3 rounded-control px-3 py-3 text-left sm:flex-col sm:gap-2.5"
            >
              {on && <m.span layoutId={`${id}-on`} transition={SNAPPY} aria-hidden="true" className="absolute inset-0 rounded-control bg-s2" />}
              <span className="relative flex w-auto items-center sm:w-full">
                <span className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${DOT[s.tone]}`}>{s.icon}</span>
                {/* the connector to the next step */}
                {i < steps.length - 1 && <span aria-hidden="true" className="ml-2 hidden h-px flex-1 bg-border-strong sm:block" />}
              </span>
              <span className="relative flex min-w-0 flex-col gap-0.5">
                <span className={`text-callout font-medium ${on ? "text-fg" : "text-fg-2 group-hover:text-fg"}`}>{s.label}</span>
                <span className="truncate font-mono text-callout text-fg">{s.sub}</span>
                <span className={`text-caption ${s.tone === "recur" ? "text-recur" : s.tone === "proven" ? "text-proven" : "text-fg-3"}`}>{s.meta}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${sel}`} tabIndex={0} className="border-t border-border-soft px-5 py-4">
        {lane ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-callout text-fg-2">
                <span className="font-mono text-fg">{lane.sha}</span> · {lane.title} · the test must <strong className="font-medium text-fg">{lane.must}</strong>
              </span>
              <span className="text-caption tabular-nums text-fg-3">{lane.runs.length ? `${duration(lane.runs.reduce((a, r) => a + r.durationMs, 0))} total` : ""}</span>
            </div>
            <RunCells runs={[0, 1, 2].map((i) => lane.runs[i])} />
            {lane.runs.find((r) => r.message) && <p className="m-0 truncate rounded-chip bg-sunken px-3 py-2 font-mono text-caption text-fg-2">{lane.runs.find((r) => r.message)?.message}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-callout text-fg-3">
              {incident.key} · opened {incident.opened} · from {incident.source}
            </span>
            <p className="m-0 text-ui text-fg">{incident.observed || "What was observed was not recorded."}</p>
          </div>
        )}
        {footer && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-caption text-fg-3">{footer}</div>}
      </div>
    </div>
  );
}
