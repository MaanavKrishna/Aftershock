import Link from "next/link";
import type { ReactNode } from "react";
import { Strip, toCells } from "@/components/ui/Strip";
import { VerdictPill } from "@/components/ui/Pill";
import type { PrCheckRow, RepositoryRow, CheckVerdict } from "@/lib/db/schema";
import type { RunResult } from "@/lib/domain/verdict";
import { duration, timeAgo } from "@/lib/format";

/** Activity and trail dots: verdict colours for outcomes, neutral otherwise. */
export const TONE_DOT: Record<string, string> = { pass: "bg-proven", fail: "bg-recur", neutral: "bg-fg-3", pending: "border-2 border-fg-3 bg-transparent" };
/** Older name. */
export const DOT = TONE_DOT;

/** A compact pull request check row (overview, incident page). */
export function CheckRow({ check, repo, results, skipped }: { check: PrCheckRow; repo: RepositoryRow; results: { runs: RunResult[] }[]; skipped: number }) {
  const runs = results.flatMap((r) => r.runs);
  return (
    <Link href={`/pulls/${check.prNumber}?repo=${repo.name}`} className="group flex items-center gap-3 border-b border-border-soft px-5 py-3 text-inherit no-underline transition-colors duration-150 last:border-b-0 hover:bg-s2/60">
      <span className="w-11 shrink-0 font-mono text-callout tabular-nums text-fg-3">#{check.prNumber}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-ui font-medium text-fg">{check.title}</span>
        <span className="truncate text-caption text-fg-3">
          {repo.name} · {results.length} {results.length === 1 ? "test" : "tests"} run{skipped ? ` · ${skipped} skipped` : ""}
          {check.durationMs ? ` · ${duration(check.durationMs)}` : ""} · {timeAgo(check.createdAt)}
        </span>
      </span>
      <span className="w-16 shrink-0 max-sm:hidden">
        <Strip cells={toCells(runs, Math.max(3, Math.min(6, runs.length)))} height={8} />
      </span>
      <VerdictPill verdict={check.verdict as CheckVerdict | null} />
    </Link>
  );
}

/** Link filters as a segmented strip: each option is a URL, the current one is marked with aria-current. */
export function FilterChips({ label, items }: { label: string; items: { href: string; label: ReactNode; active: boolean; count?: number }[] }) {
  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto">
      <ul className="m-0 inline-flex list-none gap-0.5 rounded-control bg-s2 p-0.5">
        {items.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-chip px-3 text-callout font-medium no-underline transition-[background-color,color,box-shadow] duration-150 ease-fl ${t.active ? "bg-s1 text-fg shadow-e1" : "text-fg-2 hover:text-fg"}`}
            >
              {t.label}
              {t.count !== undefined && <span className="tabular-nums text-fg-3">{t.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Label/value rows for side panels (environment, evidence). */
export function KeyValue({ rows, mono = true }: { rows: [string, ReactNode][]; mono?: boolean }) {
  return (
    <dl className="m-0">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-border-soft px-5 py-2.5 last:border-b-0">
          <dt className="shrink-0 text-callout text-fg-3">{k}</dt>
          <dd className={`m-0 min-w-0 break-words text-right text-callout text-fg ${mono ? "font-mono" : ""}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A small uppercase-free section label inside cards. */
export function Eyebrow({ children, tone }: { children: ReactNode; tone?: "recur" | "proven" }) {
  return <span className={`text-caption font-medium ${tone === "recur" ? "text-recur" : tone === "proven" ? "text-proven" : "text-fg-3"}`}>{children}</span>;
}
