"use client";
import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "@/components/ui/icons";

export type SearchEntry = { href: string; title: string; section?: string };

/** Client-side search over doc titles and section headings. No network, no tracking. */
export function DocsSearch({ entries }: { entries: SearchEntry[] }) {
  const id = useId();
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return entries.filter((e) => `${e.title} ${e.section ?? ""}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, entries]);
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">Search the docs</label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true">
        <Search size={16} />
      </span>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setQ("")}
        placeholder="Search the docs"
        autoComplete="off"
        className="min-h-10 w-full rounded-control border border-field bg-s1 pl-9 pr-3 text-ui text-fg outline-none transition-colors duration-150 placeholder:text-fg-3 focus:border-signal"
      />
      {hits.length > 0 && (
        <ul className="absolute inset-x-0 top-12 z-20 m-0 list-none overflow-hidden rounded-card border border-border bg-s1 p-1 shadow-e2">
          {hits.map((h) => (
            <li key={`${h.href}${h.section}`}>
              <Link href={h.href} onClick={() => setQ("")} className="flex flex-col rounded-control px-3 py-2 text-ui text-fg no-underline hover:bg-s2 focus-visible:bg-s2">
                <span>{h.section ?? h.title}</span>
                {h.section && <span className="text-caption text-fg-3">{h.title}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && hits.length === 0 && <p className="m-0 mt-2 px-1 text-callout text-fg-3">Nothing matches. Try another word.</p>}
    </div>
  );
}
