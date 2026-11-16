"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export type DocsGroup = { title: string; items: { href: string; title: string }[] };

function Links({ groups, path }: { groups: DocsGroup[]; path: string }) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.title} className="flex flex-col gap-0.5">
          <h2 className="m-0 mb-1.5 px-3 font-mono text-caption uppercase text-fg-3">{g.title}</h2>
          {g.items.map((d) => {
            const current = path === d.href;
            return (
              <Link
                key={d.href}
                href={d.href}
                aria-current={current ? "page" : undefined}
                className={`relative flex min-h-8 items-center rounded-control px-3 text-ui no-underline transition-colors duration-150 ${current ? "bg-s2 font-medium text-fg" : "text-fg-2 hover:bg-s2 hover:text-fg"}`}
              >
                {d.title}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Docs navigation: a sticky sidebar on large screens, a disclosure on phones. Marks the current page. */
export function DocsNav({ groups }: { groups: DocsGroup[] }) {
  const path = usePathname() ?? "/docs";
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  const current = groups.flatMap((g) => g.items).find((d) => d.href === path)?.title ?? "Docs";
  return (
    <>
      <nav aria-label="Docs" className="hidden lg:block">
        <Links groups={groups} path={path} />
      </nav>
      <details ref={ref} className="group rounded-card border border-border bg-s1 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-ui font-medium text-fg [&::-webkit-details-marker]:hidden">
          <span>
            <span className="text-fg-3">Docs / </span>
            {current}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" className="text-fg-3 transition-transform duration-200 group-open:rotate-180">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <nav aria-label="Docs pages" className="border-t border-border-soft px-1 py-4">
          <Links groups={groups} path={path} />
        </nav>
      </details>
    </>
  );
}
