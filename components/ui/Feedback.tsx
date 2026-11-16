import type { ReactNode } from "react";

/** Placeholder shimmer while data loads. Static under reduced motion. */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-chip bg-s2 motion-reduce:animate-none ${className}`} />;
}

/** Shown when a list has nothing yet: say what will appear and offer the next step. */
export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong px-6 py-12 text-center">
      {icon && <span className="flex h-10 w-10 items-center justify-center rounded-control bg-s2 text-fg-2">{icon}</span>}
      <h2 className="m-0 text-title-3 font-semibold text-fg">{title}</h2>
      {children && <div className="m-0 max-w-[46ch] text-ui text-fg-3">{children}</div>}
      {action}
    </div>
  );
}

/** Keyboard key. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-[5px] border border-border-strong bg-s1 px-1 font-mono text-caption text-fg-2 shadow-e1">{children}</kbd>;
}

/** Small neutral or accent label (version, plan, "Labs"). */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "signal" | "outline" }) {
  const t = tone === "signal" ? "bg-signal-soft text-signal" : tone === "outline" ? "border border-border-strong text-fg-2" : "bg-s2 text-fg-2";
  return <span className={`inline-flex w-fit min-h-5 items-center rounded-full px-2 text-caption font-medium ${t}`}>{children}</span>;
}

/** A hint shown on hover and keyboard focus; the trigger is described by it for screen readers. */
export function Tooltip({ id, tip, children }: { id: string; tip: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      <span aria-describedby={id}>{children}</span>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-chip bg-fg px-2 py-1 text-caption text-canvas opacity-0 shadow-e2 transition-[opacity,transform] duration-150 ease-fl group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
      >
        {tip}
      </span>
    </span>
  );
}

/** Page heading block used at the top of every app view. */
export function PageHeader({ title, sub, actions, eyebrow }: { title: string; sub?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <span className="text-callout font-medium text-fg-3">{eyebrow}</span>}
        <h1 className="m-0 text-title-1 font-semibold text-fg">{title}</h1>
        {sub && <p className="m-0 max-w-[70ch] text-ui text-fg-3">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
