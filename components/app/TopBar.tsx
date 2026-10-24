import Link from "next/link";
import type { ReactNode } from "react";
import { currentScope } from "@/lib/auth/scope";
import { CommandPalette } from "./CommandPalette";
import { Inbox } from "./Inbox";
import { MobileDrawer } from "./MobileDrawer";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "@/components/ds/ThemeToggle";

/** Page header: breadcrumbs or title, the page's own actions, then search, activity and theme. */
export async function TopBar({ crumbs, title, children }: { crumbs?: { label: string; href?: string }[]; title?: string; children?: ReactNode }) {
  const { scope, session } = await currentScope();
  const inbox = (await scope.inbox(12)).map((i) => ({ ...i, createdAt: new Date(i.createdAt).toISOString() }));
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-paper/90 px-8 py-3 text-[13px] text-muted-2 backdrop-blur max-sm:px-4">
      <MobileDrawer>
        <Sidebar scope={scope} userId={session.userId} />
      </MobileDrawer>
      {title && <span className="text-sm font-semibold text-ink">{title}</span>}
      {crumbs?.map((c, i) => (
        <span key={i} className="flex items-center gap-3">
          {i > 0 && <span className="text-muted-2" aria-hidden="true">/</span>}
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
      <span className="flex items-center gap-2">
        <CommandPalette />
        <Inbox items={inbox} />
        <ThemeToggle />
      </span>
    </header>
  );
}

export function Main({ children }: { children: ReactNode }) {
  return <main id="main" className="flex flex-col gap-5 px-8 pb-16 pt-7 max-sm:px-4">{children}</main>;
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
