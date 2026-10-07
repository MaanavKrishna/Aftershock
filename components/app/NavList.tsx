"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, string> = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  incidents: "M12 3 2 20h20L12 3z M12 10v4 M12 17h.01",
  memory: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z M9 12l2 2 4-4",
  pulls: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 9v12 M18 15V9a3 3 0 0 0-3-3h-4",
  repositories: "M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z M4 16a4 4 0 0 1 4-4h12",
  integrations: "M9 2v6 M15 2v6 M6 8h12v4a6 6 0 0 1-12 0z M12 18v4",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12h2 M3 12h2 M12 3v2 M12 19v2 M17 7l1.5-1.5 M5.5 18.5 7 17 M17 17l1.5 1.5 M5.5 5.5 7 7",
};

export type NavItem = { id: keyof typeof ICONS; label: string; badge?: number; hot?: boolean };

export function NavList({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((n) => {
        const href = `/${n.id}`;
        const on = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={n.id}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-[42px] items-center gap-[11px] rounded-lg px-2.5 text-sm no-underline ${on ? "bg-paper font-semibold text-ink" : "font-medium text-[#AEB8C4] hover:bg-ink-2 hover:text-on-dark"}`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONS[n.id]} />
            </svg>
            <span className="flex-1">{n.label}</span>
            {n.badge ? (
              <span className={`rounded-[10px] px-[7px] py-px font-mono text-[11px] font-semibold ${n.hot ? "bg-fail text-white" : on ? "bg-line text-ink" : "bg-ink-line text-[#C9D1DA]"}`}>{n.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
