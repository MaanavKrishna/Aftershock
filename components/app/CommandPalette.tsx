"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { Kbd } from "@/components/ui/Feedback";
import { ArrowRight, Bolt, Plus, Repo, Search } from "@/components/ui/icons";
import { SNAPPY } from "@/lib/motion";

type Kind = "action" | "page" | "incident" | "repo";
type Item = { id: string; label: string; hint: string; href: string; kind: Kind };

const PAGES: Item[] = [
  ["overview", "Overview"], ["incidents", "Incidents"], ["memory", "Memory"], ["pulls", "Pull requests"], ["insights", "Insights"], ["repositories", "Repositories"], ["integrations", "Integrations"], ["settings", "Settings"],
].map(([id, label]) => ({ id: `page-${id}`, label, hint: "Go to", href: `/${id}`, kind: "page" as const }));
const ACTIONS: Item[] = [
  { id: "new", label: "Record a new incident", hint: "Action", href: "/incidents/new" },
  { id: "import", label: "Import incidents from GitHub issues", hint: "Action", href: "/incidents/new?tab=issue" },
  { id: "notify", label: "Notification settings", hint: "Settings", href: "/settings?tab=notifications" },
  { id: "labs", label: "Labs features", hint: "Settings", href: "/settings?tab=labs" },
  { id: "tokens", label: "API tokens", hint: "Settings", href: "/settings?tab=tokens" },
  { id: "audit", label: "Audit log", hint: "Settings", href: "/settings?tab=audit" },
  { id: "docs", label: "Documentation", hint: "Help", href: "/docs" },
].map((a) => ({ ...a, kind: "action" as const }));

/** Substring matches rank first (earlier is better); otherwise every query character must appear in order. */
function score(label: string, q: string): number {
  const l = label.toLowerCase();
  const at = l.indexOf(q);
  if (at >= 0) return 1000 - at - l.length / 100;
  let i = 0;
  let gaps = 0;
  let last = -1;
  for (const ch of q.replace(/\s+/g, "")) {
    const j = l.indexOf(ch, last + 1);
    if (j < 0) return -1;
    if (last >= 0) gaps += j - last - 1;
    last = j;
    i++;
  }
  return i ? 500 - gaps : -1;
}

function Highlight({ text, q }: { text: string; q: string }) {
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-fg">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

const ICON: Record<Kind, ReactNode> = { action: <Plus size={15} />, page: <ArrowRight size={15} />, incident: <Bolt size={15} />, repo: <Repo size={15} /> };

/** ⌘K / Ctrl+K: jump to any page, action, repository or incident by typing. */
export function CommandPalette({ repos = [] }: { repos?: string[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [incidents, setIncidents] = useState<Item[]>([]);

  const load = useCallback(() => {
    fetch("/api/v1/incidents")
      .then((r) => (r.ok ? r.json() : { incidents: [] }))
      .then((d: { incidents: { key: string; number: number; title: string; status: string }[] }) =>
        setIncidents(d.incidents.slice(0, 300).map((i) => ({ id: `inc-${i.number}`, label: `${i.key} ${i.title}`, hint: i.status.replace("_", " "), href: `/incidents/${i.number}`, kind: "incident" as const }))),
      )
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

  const t = q.trim().toLowerCase();
  const results = useMemo(() => {
    const repoItems: Item[] = repos.map((r) => ({ id: `repo-${r}`, label: r, hint: "Repository", href: `/memory?repo=${encodeURIComponent(r)}`, kind: "repo" }));
    if (!t) return [...ACTIONS.slice(0, 2), ...PAGES];
    return [...ACTIONS, ...PAGES, ...repoItems, ...incidents]
      .map((i) => ({ i, s: score(i.label, t) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.i);
  }, [t, incidents, repos]);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (i: Item | undefined) => {
    if (!i) return;
    dialog.current?.close();
    router.push(i.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Search (Command K)"
        className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-control text-callout text-fg-3 hover:text-fg max-md:w-10 max-md:justify-center md:min-w-52 md:border md:border-border md:bg-s1 md:pl-2.5 md:pr-1.5 md:hover:border-border-strong"
      >
        <Search size={15} />
        <span className="flex-1 text-left max-md:sr-only">Search…</span>
        <span className="max-md:hidden" aria-hidden="true">
          <Kbd>⌘K</Kbd>
        </span>
      </button>
      <dialog
        ref={dialog}
        aria-label="Command palette"
        onClose={() => setQ("")}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="glass mx-auto mt-[12vh] w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-stage border border-border p-0 text-fg shadow-e2 backdrop:bg-black/30 open:animate-[fl-in_200ms_var(--ease-fl)]"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <span className="text-fg-3">
            <Search size={17} />
          </span>
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => (results.length ? (a + 1) % results.length : 0));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
              }
              if (e.key === "Home") setActive(0);
              if (e.key === "End") setActive(Math.max(0, results.length - 1));
              if (e.key === "Enter") {
                e.preventDefault();
                go(results[active]);
              }
            }}
            placeholder="Search pages, actions, repositories and incidents"
            aria-label="Search pages, actions and incidents"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
            aria-autocomplete="list"
            role="combobox"
            aria-expanded="true"
            className="min-h-14 min-w-0 flex-1 border-0 bg-transparent text-body text-fg outline-none placeholder:text-fg-3 focus-visible:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul ref={list} id="palette-results" role="listbox" aria-label="Results" className="m-0 max-h-[min(420px,60vh)] list-none overflow-y-auto p-2">
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`palette-${r.id}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => go(r)}
              className="relative flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-ui text-fg-2"
            >
              {i === active && <m.span layoutId="palette-active" transition={SNAPPY} aria-hidden="true" className="absolute inset-0 rounded-control bg-s2" />}
              <span className={`relative shrink-0 ${i === active ? "text-fg" : "text-fg-3"}`}>{ICON[r.kind]}</span>
              <span className={`relative min-w-0 flex-1 truncate ${i === active ? "text-fg" : ""}`}>
                <Highlight text={r.label} q={t} />
              </span>
              <span className="relative shrink-0 text-caption capitalize text-fg-3">{r.hint}</span>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-8 text-center text-ui text-fg-3">Nothing matches “{q}”.</li>}
        </ul>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-caption text-fg-3 max-sm:hidden">
          <span className="inline-flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> to move</span>
          <span className="inline-flex items-center gap-1.5"><Kbd>↵</Kbd> to open</span>
        </div>
      </dialog>
    </>
  );
}
