"use client";
import { useId, useMemo, useState } from "react";
import Link from "next/link";

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
      <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the docs" autoComplete="off" className="min-h-11 w-full rounded-control border border-rule-strong bg-canvas px-3 text-[14px] text-fg outline-none focus:border-signal" />
      {hits.length > 0 && (
        <ul className="absolute inset-x-0 top-12 z-20 m-0 list-none overflow-hidden rounded-control border border-rule bg-raised p-1 shadow-lift">
          {hits.map((h) => (
            <li key={`${h.href}${h.section}`}>
              <Link href={h.href} onClick={() => setQ("")} className="flex flex-col rounded-chip px-3 py-2 text-[14px] text-fg no-underline hover:bg-raised-2">
                <span>{h.section ?? h.title}</span>
                {h.section && <span className="text-[12.5px] text-fg-3">{h.title}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && hits.length === 0 && <p className="m-0 mt-2 text-[13px] text-fg-3">Nothing matches. Try another word.</p>}
    </div>
  );
}
