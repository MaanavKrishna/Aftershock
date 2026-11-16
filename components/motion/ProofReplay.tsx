"use client";
import { useEffect, useRef, useState } from "react";
import * as m from "motion/react-m";
import { useInView, useReducedMotion } from "motion/react";
import { Check, Cross } from "@/components/ui/icons";
import { Verdict } from "@/components/ui/Verdict";
import { EASE } from "@/lib/motion";

const STAGES = [
  "INC-12 comes in from a GitHub issue: a payment retry charged a customer twice.",
  "A model drafts a regression test from the incident and the fix. It is only a draft.",
  "On 3f2a1c9, the commit before the fix, the test fails three times out of three. The bug reproduces.",
  "Git history moves to aa86f56, the fix.",
  "On the fix the test passes three times out of three. It is proven and joins memory.",
  "Weeks later, pull request 214 refactors payments. The test fails again, so the check blocks the merge.",
] as const;
const DURATION = [1600, 2400, 2200, 1300, 2200, 3200];
const LAST = STAGES.length - 1;

const TEST = [
  "def test_retry_after_lost_ack_does_not_double_charge(client, order):",
  "    first = client.post(\"/payments\", json={\"order_id\": order.id})",
  "    retry = client.post(\"/payments\", json={\"order_id\": order.id})",
  "    assert retry.status_code == 400",
  "    assert payment_count(order.id) == 1",
];

/** A seismic trace: rough while the bug is live, flat once the proof lands. Same point count, so it morphs. */
function trace(calm: boolean, w = 600, h = 56): string {
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * w;
    const burst = Math.exp(-((i - 22) ** 2) / 40) + 0.6 * Math.exp(-((i - 41) ** 2) / 26);
    const amp = calm ? 1.2 : 4 + 22 * burst;
    const y = h / 2 + Math.sin(i * 1.7) * amp * (i % 2 ? 1 : -0.8);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

function Cells({ kind, on }: { kind: "fail" | "pass"; on: boolean }) {
  return (
    <span className="flex gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="relative flex h-7 w-7 items-center justify-center rounded-chip border border-dashed border-border-strong">
          <m.span
            initial={false}
            animate={on ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30, delay: on ? i * 0.16 : 0 }}
            className={`absolute -inset-px flex items-center justify-center rounded-chip ${kind === "fail" ? "bg-recur-soft text-recur" : "bg-proven-soft text-proven"}`}
          >
            {kind === "fail" ? <Cross size={14} /> : <Check size={14} />}
          </m.span>
        </span>
      ))}
    </span>
  );
}

function Row({ at, stage, children, label }: { at: number; stage: number; label: string; children: React.ReactNode }) {
  const reached = stage >= at;
  // Rows still to come use the tertiary text colour (AA contrast) rather than opacity.
  return (
    <li data-pending={reached ? undefined : ""} className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-soft px-4 py-3 transition-colors duration-300 first:border-t-0 sm:px-5">
      <span className="flex w-full shrink-0 items-center gap-2 text-callout text-fg-3 sm:w-[112px]">
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${reached ? "bg-fg-2" : "bg-border-strong"}`} />
        {label}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{children}</span>
    </li>
  );
}

export function ProofReplay() {
  const reduce = useReducedMotion();
  // Server and first client render always agree (stage 0); reduced motion jumps to the end right after.
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [lines, setLines] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The story starts once the replay is on screen, so nobody scrolls down to a finished state.
  const root = useRef<HTMLElement>(null);
  const seen = useInView(root, { once: true, amount: 0.4 });

  useEffect(() => {
    if (reduce) {
      setStage(LAST);
      setLines(TEST.length);
      setPlaying(false);
    }
  }, [reduce]);

  useEffect(() => {
    if (!playing || !seen) return;
    if (stage >= LAST) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setStage((s) => Math.min(LAST, s + 1)), DURATION[stage]);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, stage, seen]);

  // The test "streams" in while stage 1 plays.
  useEffect(() => {
    if (stage < 1) return setLines(0);
    if (stage > 1 || !playing) return setLines(TEST.length);
    if (!seen) return;
    let n = 0;
    const id = setInterval(() => {
      n++;
      setLines(n);
      if (n >= TEST.length) clearInterval(id);
    }, 380);
    return () => clearInterval(id);
  }, [stage, playing, seen]);

  const replay = () => {
    setStage(0);
    setLines(0);
    setPlaying(true);
  };

  const status = stage >= 5 ? "Aftershock on PR #214" : stage >= 4 ? "Settled: INC-12 is guarded" : "INC-12 · live";
  return (
    <figure ref={root} className="m-0 flex flex-col overflow-hidden rounded-stage border border-border bg-s1 shadow-e2" aria-label="Replay of a real proof: INC-12">
      <div className="relative border-b border-border-soft bg-sunken px-4 pb-2.5 pt-4 sm:px-5">
        <svg viewBox="0 0 600 56" className="h-14 w-full" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2="600" y1="28" y2="28" className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <m.path d={trace(false)} initial={false} animate={{ d: trace(stage >= 4 && stage < 5) }} transition={{ duration: 0.9, ease: EASE }} fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" className={`transition-colors duration-500 ${stage >= 5 ? "stroke-recur" : stage >= 4 ? "stroke-proven" : "stroke-fg-3"}`} />
        </svg>
        <div className="flex items-center justify-between gap-3 pt-1.5">
          <span className="flex items-center gap-2 font-mono text-caption text-fg-3">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${stage >= 5 ? "bg-recur" : stage >= 4 ? "bg-proven" : "bg-fg-3"}`} />
            {status}
          </span>
          <button type="button" onClick={() => (stage >= LAST ? replay() : setPlaying((p) => !p))} className="inline-flex min-h-8 cursor-pointer items-center rounded-control border border-border-strong bg-s1 px-3 text-callout font-medium text-fg-2 transition-colors duration-150 hover:bg-s2 hover:text-fg">
            {stage >= LAST ? "Replay" : playing ? "Pause" : "Play"}
          </button>
        </div>
      </div>
      <ol className="m-0 list-none p-0">
        <Row at={0} stage={stage} label="Incident">
          <span className="font-medium text-fg">Payment retry charged a customer twice</span>
          <span className="text-callout text-fg-3">GitHub issue #41</span>
        </Row>
        <Row at={1} stage={stage} label="Draft">
          <pre tabIndex={0} aria-label="Drafted test" className="m-0 w-full overflow-x-auto rounded-control border border-border-soft bg-sunken px-3 py-2.5 font-mono text-caption leading-relaxed text-fg-2">
            {TEST.map((l, i) => (
              <span key={i} className={`block whitespace-pre transition-opacity duration-200 ${i < lines ? "" : "opacity-0"}`}>{l}</span>
            ))}
          </pre>
          <Verdict kind="drafted" size="sm" label="AI draft, not trusted yet" />
        </Row>
        <Row at={2} stage={stage} label="Before the fix">
          <span className="font-mono text-callout text-fg">3f2a1c9</span>
          <Cells kind="fail" on={stage >= 2} />
          <span className="text-callout text-fg-2">fails 3 of 3: the bug reproduces</span>
        </Row>
        <Row at={3} stage={stage} label="Time travel">
          <span className="relative flex h-1.5 w-40 items-center rounded-full bg-s3" aria-hidden="true">
            <m.span initial={false} animate={{ x: stage >= 3 ? 150 : 0 }} transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }} className="absolute left-0 h-2.5 w-2.5 rounded-full bg-fg shadow-e1" />
          </span>
          <span className="font-mono text-callout text-fg">aa86f56</span>
          <span className="text-callout text-fg-2">fix: reject duplicate pending payment</span>
        </Row>
        <Row at={4} stage={stage} label="On the fix">
          <span className="font-mono text-callout text-fg">aa86f56</span>
          <Cells kind="pass" on={stage >= 4} />
          {stage >= 4 ? <Verdict kind="proven" size="sm" /> : <span className="text-callout text-fg-3">proven</span>}
        </Row>
        <Row at={5} stage={stage} label="Pull request">
          <span className="text-ui text-fg">#214 refactor payments</span>
          <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-chip px-2 text-callout font-medium transition-colors duration-300 ${stage >= 5 ? "bg-recur-soft text-recur" : "bg-s2 text-fg-3"}`}>
            <Cross size={14} />
            Recur: INC-12 would ship again
          </span>
        </Row>
      </ol>
      <figcaption className="sr-only" aria-live="polite">{STAGES[stage]}</figcaption>
    </figure>
  );
}
