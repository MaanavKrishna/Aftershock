import Link from "next/link";
import type { ReactNode } from "react";

export function TopBar({ crumbs, title, children }: { crumbs?: { label: string; href?: string }[]; title?: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-line px-8 py-3 text-[13px] text-muted-2 max-sm:px-4">
      {title && <span className="text-sm font-semibold text-ink">{title}</span>}
      {crumbs?.map((c, i) => (
        <span key={i} className="flex items-center gap-3">
          {i > 0 && <span className="text-[#B4B8BE]">/</span>}
          {c.href ? (
            <Link href={c.href} className="inline-flex min-h-10 items-center text-muted-2 no-underline hover:text-ink">
              {c.label}
            </Link>
          ) : (
            <span className="font-semibold text-ink">{c.label}</span>
          )}
        </span>
      ))}
      <span className="flex-1" />
      {children}
    </header>
  );
}

export function Main({ children }: { children: ReactNode }) {
  return <main className="flex flex-col gap-5 px-8 pb-16 pt-7 max-sm:px-4">{children}</main>;
}

export function PageTitle({ title, sub, eyebrow }: { title: ReactNode; sub?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {eyebrow && <span className="font-mono text-[12.5px] text-muted-2">{eyebrow}</span>}
      <h1 className="m-0 text-[30px] font-semibold leading-[1.15] tracking-[-0.025em] max-sm:text-[26px]">{title}</h1>
      {sub && <span className="text-muted">{sub}</span>}
    </div>
  );
}
