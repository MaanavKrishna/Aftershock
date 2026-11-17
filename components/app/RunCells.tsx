"use client";
import { useEffect, useRef } from "react";
import * as m from "motion/react-m";
import { Check, Cross, Dashed, Half } from "@/components/ui/icons";
import { SNAPPY } from "@/lib/motion";
import { duration } from "@/lib/format";

type R = { outcome: string; durationMs?: number } | undefined;

const LOOK = {
  failed: { cls: "border-recur-line bg-recur-soft text-recur", Icon: Cross, word: "Failed" },
  passed: { cls: "border-transparent bg-proven-soft text-proven", Icon: Check, word: "Passed" },
  error: { cls: "border-border-strong bg-s2 text-fg-2", Icon: Half, word: "Error" },
  pending: { cls: "border-dashed border-border-strong bg-transparent text-fg-3", Icon: Dashed, word: "Pending" },
} as const;

/**
 * The three runs on one commit. A cell settles in with a spring only when its result lands while you watch,
 * never on first paint.
 */
export function RunCells({ runs, compact = false }: { runs: R[]; compact?: boolean }) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return (
    <ol className="m-0 flex list-none gap-2 p-0" aria-label="Runs">
      {[0, 1, 2].map((i) => {
        const r = runs[i];
        const kind = (r && r.outcome in LOOK ? r.outcome : "pending") as keyof typeof LOOK;
        const { cls, Icon, word } = LOOK[kind];
        return (
          <m.li
            key={`${i}-${kind}`}
            initial={mounted.current && r ? { scale: 0.92, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SNAPPY, delay: i * 0.06 }}
            className={`flex min-w-0 flex-1 flex-col gap-0.5 rounded-control border ${compact ? "px-2 py-1.5" : "px-3 py-2"} ${cls}`}
          >
            <span className="text-caption text-fg-3">Run {i + 1}</span>
            <span className="inline-flex items-center gap-1.5 text-callout font-medium">
              <Icon size={13} />
              {word}
            </span>
            {!compact && <span className="font-mono text-caption tabular-nums text-fg-3">{r?.durationMs != null ? duration(r.durationMs) : "—"}</span>}
          </m.li>
        );
      })}
    </ol>
  );
}
