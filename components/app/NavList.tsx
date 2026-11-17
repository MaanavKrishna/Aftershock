"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as m from "motion/react-m";
import { Bolt, Chart, Gear, Home, Memory, Plug, PullRequest, Repo } from "@/components/ui/icons";
import { SNAPPY } from "@/lib/motion";

const ICONS = { overview: Home, incidents: Bolt, memory: Memory, pulls: PullRequest, insights: Chart, repositories: Repo, integrations: Plug, settings: Gear } as const;

export type NavItem = { id: keyof typeof ICONS; label: string; badge?: number; hot?: boolean; badgeLabel?: string };

/** Primary navigation. In `rail` mode the labels hide between 768 and 1024px and become tooltips. */
export function NavList({ items, rail = false }: { items: NavItem[]; rail?: boolean }) {
  const path = usePathname();
  return (
    <ul className="m-0 flex w-full list-none flex-col gap-0.5 p-0">
      {items.map((n) => {
        const href = `/${n.id}`;
        const on = path === href || path.startsWith(href + "/");
        const Icon = ICONS[n.id];
        return (
          <li key={n.id} className="relative">
            {on && <m.span layoutId={rail ? "nav-on-rail" : "nav-on"} transition={SNAPPY} aria-hidden="true" className="absolute inset-0 rounded-control bg-s2 shadow-e1" />}
            <Link
              href={href}
              title={rail ? n.label : undefined}
              aria-current={on ? "page" : undefined}
              className={`relative flex min-h-9 items-center gap-2.5 rounded-control px-2.5 text-ui no-underline transition-colors duration-150 ease-fl ${on ? "font-medium text-fg" : "text-fg-2 hover:bg-s2/70 hover:text-fg"} ${rail ? "max-lg:justify-center max-lg:px-0 max-lg:min-h-10" : ""}`}
            >
              <Icon size={16} />
              <span className={`flex-1 truncate ${rail ? "max-lg:sr-only" : ""}`}>{n.label}</span>
              {n.badge ? (
                <>
                  <span className={`min-w-5 rounded-full px-1.5 text-center text-caption font-medium tabular-nums ${n.hot ? "bg-recur-soft text-recur" : "bg-s3 text-fg-2"} ${rail ? "max-lg:sr-only" : ""}`}>
                    {n.badge}
                    <span className="sr-only"> {n.badgeLabel ?? ""}</span>
                  </span>
                  {rail && <span aria-hidden="true" className={`absolute right-1.5 top-1.5 hidden h-1.5 w-1.5 rounded-full max-lg:block ${n.hot ? "bg-recur" : "bg-fg-3"}`} />}
                </>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
