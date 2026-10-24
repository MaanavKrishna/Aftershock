"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; label: string; hint: string; href: string };

const PAGES: Item[] = [
  ["overview", "Overview"], ["incidents", "Incidents"], ["memory", "Memory"], ["pulls", "Pull requests"], ["insights", "Insights"], ["repositories", "Repositories"], ["integrations", "Integrations"], ["settings", "Settings"],
].map(([id, label]) => ({ id: `page-${id}`, label, hint: "Go to", href: `/${id}` }));
const ACTIONS: Item[] = [
  { id: "new", label: "Record a new incident", hint: "Action", href: "/incidents/new" },
  { id: "import", label: "Import incidents from GitHub issues", hint: "Action", href: "/incidents/new?tab=issue" },
  { id: "notify", label: "Notification settings", hint: "Settings", href: "/settings?tab=notifications" },
  { id: "labs", label: "Labs features", hint: "Settings", href: "/settings?tab=labs" },
  { id: "tokens", label: "API tokens", hint: "Settings", href: "/settings?tab=tokens" },
  { id: "audit", label: "Audit log", hint: "Settings", href: "/settings?tab=audit" },
  { id: "docs", label: "Documentation", hint: "Help", href: "/docs" },
];

/** ⌘K / Ctrl+K: jump to any page, action or incident by typing. */
export function CommandPalette() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [incidents, setIncidents] = useState<Item[]>([]);

  const load = useCallback(() => {
    fetch("/api/v1/incidents")
      .then((r) => (r.ok ? r.json() : { incidents: [] }))
      .then((d: { incidents: { key: string; number: number; title: string; status: string }[] }) => setIncidents(d.incidents.slice(0, 300).map((i) => ({ id: `inc-${i.number}`, label: `${i.key} ${i.title}`, hint: i.status.replace("_", " "), href: `/incidents/${i.number}` }))))
      .catch(() => undefined);
  }, []);

  // Incidents load once the page is idle, so the palette is ready when it opens; opening refreshes them.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(load);
    else setTimeout(load, 800);
  }, [load]);

  const open = useCallback(() => {
    setQ("");
    setActive(0);
    dialog.current?.showModal();
    input.current?.focus();
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = [...ACTIONS, ...PAGES, ...incidents];
    return (t ? all.filter((i) => i.label.toLowerCase().includes(t)) : [...ACTIONS.slice(0, 2), ...PAGES]).slice(0, 12);
  }, [q, incidents]);

  const go = (i: Item | undefined) => {
    if (!i) return;
    dialog.current?.close();
    router.push(i.href);
  };

  return (
    <>
      <button type="button" onClick={open} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 text-[13px] text-muted hover:text-ink">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span className="max-md:sr-only">Search</span>
        <kbd className="rounded border border-line px-1.5 font-sans text-[11px] max-md:hidden">⌘K</kbd>
      </button>
      <dialog ref={dialog} aria-label="Command palette" onClose={() => setQ("")} className="m-auto mt-[12vh] w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-[14px] border border-line bg-card p-0 text-ink shadow-[0_24px_64px_-24px_rgba(0,0,0,0.5)] backdrop:bg-black/40">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
            }}
            placeholder="Search pages, actions and incidents"
            aria-label="Search pages, actions and incidents"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
            role="combobox"
            aria-expanded="true"
            className="min-h-14 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none focus-visible:outline-none"
          />
          <kbd className="rounded border border-line px-1.5 text-[11px] text-muted">Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" className="m-0 max-h-[min(420px,60vh)] list-none overflow-y-auto p-1.5">
          {results.map((r, i) => (
            <li key={r.id} id={`palette-${r.id}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(r)} className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-[14px] ${i === active ? "bg-neutral-tint" : ""}`}>
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 text-[12px] capitalize text-muted">{r.hint}</span>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-[14px] text-muted">Nothing matches “{q}”.</li>}
        </ul>
      </dialog>
    </>
  );
}
