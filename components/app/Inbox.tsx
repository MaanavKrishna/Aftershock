"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TONE_DOT } from "./bits";

type Item = { id: string; title: string; detail: string; tone: string; createdAt: string; number: number | null };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}

/** Recent activity in one popover. "Unread" is remembered in this browser only. Escape and outside clicks close it. */
export function Inbox({ items }: { items: Item[] }) {
  const [seen, setSeen] = useState<number | null>(null);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    try {
      setSeen(Number(localStorage.getItem("as-inbox-seen") ?? 0));
    } catch {
      setSeen(0);
    }
  }, []);
  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) {
        d.removeAttribute("open");
        if (e instanceof KeyboardEvent) d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, []);
  const unread = seen === null ? 0 : items.filter((i) => new Date(i.createdAt).getTime() > seen).length;
  const markSeen = () => {
    const now = Date.now();
    setSeen(now);
    try {
      localStorage.setItem("as-inbox-seen", String(now));
    } catch {
      /* storage blocked: unread resets on reload */
    }
  };
  return (
    <details ref={ref} className="group relative" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && markSeen()}>
      <summary
        aria-label={unread ? `Activity, ${unread} new` : "Activity"}
        className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-control text-fg-2 hover:bg-s2 hover:text-fg group-open:bg-s2 group-open:text-fg [&::-webkit-details-marker]:hidden"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-caption font-semibold leading-none text-on-signal">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </summary>
      <div className="absolute right-0 top-12 z-40 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-card border border-border bg-s1 shadow-e2 max-sm:-right-12">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-ui font-semibold text-fg">Activity</span>
          <span className="text-caption text-fg-3">Last {items.length}</span>
        </div>
        <ul className="m-0 max-h-[min(420px,60vh)] list-none overflow-y-auto p-1.5">
          {items.map((i) => {
            const body = (
              <>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[i.tone] ?? TONE_DOT.neutral}`} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-callout font-medium text-fg">{i.title}</span>
                  {i.detail && <span className="truncate text-caption text-fg-3">{i.detail}</span>}
                </span>
                <span suppressHydrationWarning className="shrink-0 text-caption tabular-nums text-fg-3">
                  {ago(i.createdAt)}
                </span>
              </>
            );
            return (
              <li key={i.id}>
                {i.number ? (
                  <Link href={`/incidents/${i.number}`} onClick={() => ref.current?.removeAttribute("open")} className="flex gap-3 rounded-control px-2.5 py-2.5 no-underline hover:bg-s2">
                    {body}
                  </Link>
                ) : (
                  <div className="flex gap-3 px-2.5 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
          {items.length === 0 && <li className="px-4 py-8 text-center text-callout text-fg-3">Nothing yet. Activity appears as incidents come in and checks run.</li>}
        </ul>
      </div>
    </details>
  );
}
