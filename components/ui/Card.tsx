import type { ReactNode } from "react";

/** A content surface: s1 with a hairline border. `dark` is an older prop, now the same raised surface one level up. */
export function Card({ children, className = "", dark = false, as: Tag = "section" }: { children: ReactNode; className?: string; dark?: boolean; as?: "section" | "div" | "article" }) {
  return <Tag className={`overflow-hidden rounded-card border border-border ${dark ? "bg-s2" : "bg-s1"} shadow-e1 ${className}`}>{children}</Tag>;
}

export function CardHead({ children, aside, sub }: { children: ReactNode; aside?: ReactNode; dark?: boolean; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-5 py-3.5">
      <div className="flex min-w-0 flex-col">
        <span className="text-ui font-semibold text-fg">{children}</span>
        {sub && <span className="text-callout text-fg-3">{sub}</span>}
      </div>
      {aside}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

/** A single figure with its label, for overview and insights rows. */
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "proven" | "recur" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-callout text-fg-3">{label}</span>
      <span className={`text-title-1 font-semibold tabular-nums ${tone === "proven" ? "text-proven" : tone === "recur" ? "text-recur" : "text-fg"}`}>{value}</span>
      {hint && <span className="text-caption text-fg-3">{hint}</span>}
    </div>
  );
}
