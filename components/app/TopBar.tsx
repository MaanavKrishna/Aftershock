import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { currentScope } from "@/lib/auth/scope";
import { CommandPalette } from "./CommandPalette";
import { Inbox } from "./Inbox";
import { MobileDrawer } from "./MobileDrawer";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ChevronRight } from "@/components/ui/icons";

/** The page bar: breadcrumbs or title, the page's own actions, then search (⌘K), activity and theme. */
export async function TopBar({ crumbs, title, children }: { crumbs?: { label: string; href?: string }[]; title?: string; children?: ReactNode }) {
  const { scope, session } = await currentScope();
  const [inbox, repos] = await Promise.all([scope.inbox(12), scope.repos()]);
  const items = inbox.map((i) => ({ ...i, createdAt: new Date(i.createdAt).toISOString() }));
  return (
    <header className="glass sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 sm:px-6 lg:px-8">
      <MobileDrawer>
        <Suspense>
          <Sidebar scope={scope} userId={session.userId} />
        </Suspense>
      </MobileDrawer>
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center">
        <ol className="m-0 flex min-w-0 list-none items-center gap-1 p-0 text-ui">
          {title && <li className="truncate font-medium text-fg">{title}</li>}
          {crumbs?.map((c, i) => (
            <li key={i} className={`flex min-w-0 items-center gap-1 ${i < (crumbs.length - 1) ? "max-sm:hidden" : ""}`}>
              {i > 0 && (
                <span className="text-fg-3 max-sm:hidden" aria-hidden="true">
                  <ChevronRight size={14} />
                </span>
              )}
              {c.href ? (
                <Link href={c.href} className="inline-flex min-h-8 items-center truncate rounded-chip px-1.5 text-fg-2 no-underline hover:bg-s2 hover:text-fg">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate px-1.5 font-medium text-fg">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
      <div className="flex shrink-0 items-center gap-1">
        <CommandPalette repos={repos.map((r) => r.name)} />
        <Inbox items={items} />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function Main({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      {children}
    </main>
  );
}

export function PageTitle({ title, sub, eyebrow, actions }: { title: ReactNode; sub?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 max-w-3xl flex-col gap-1.5">
        {eyebrow && <span className="text-callout text-fg-3">{eyebrow}</span>}
        <h1 className="m-0 text-title-1 font-semibold text-balance text-fg">{title}</h1>
        {sub && <p className="m-0 text-ui text-fg-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
