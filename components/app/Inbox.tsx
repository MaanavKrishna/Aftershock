"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Item = { id: string; title: string; detail: string; tone: string; createdAt: string; number: number | null };
const DOT: Record<string, string> = { pass: "bg-pass", fail: "bg-fail", pending: "bg-muted-2", neutral: "bg-line-strong" };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}

/** Recent activity in one place. "Unread" is remembered in this browser only. */
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
    <details ref={ref} className="relative" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && markSeen()}>
      <summary aria-label={unread ? `Activity, ${unread} new` : "Activity"} className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line bg-card text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fail px-1 text-[10.5px] font-bold text-on-accent">{unread > 9 ? "9+" : unread}</span>}
      </summary>
      <div className="absolute right-0 top-12 z-30 w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_24px_64px_-24px_rgba(0,0,0,0.45)]">
        <div className="border-b border-line px-4 py-3 text-[13px] font-semibold text-ink">Activity</div>
        <ul className="m-0 max-h-[420px] list-none overflow-y-auto p-0">
          {items.map((i) => {
            const body = (
              <>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[i.tone] ?? DOT.neutral}`} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col"><span className="text-[13.5px] font-semibold text-ink">{i.title}</span>{i.detail && <span className="truncate text-[12.5px] text-muted">{i.detail}</span>}</span>
                <span suppressHydrationWarning className="shrink-0 text-[12px] text-muted">{ago(i.createdAt)}</span>
              </>
            );
            return (
              <li key={i.id} className="border-b border-line-soft last:border-b-0">
                {i.number ? <Link href={`/incidents/${i.number}`} onClick={() => ref.current?.removeAttribute("open")} className="flex gap-3 px-4 py-3 no-underline hover:bg-neutral-tint">{body}</Link> : <div className="flex gap-3 px-4 py-3">{body}</div>}
              </li>
            );
          })}
          {items.length === 0 && <li className="px-4 py-8 text-center text-[13.5px] text-muted">Nothing yet. Activity appears as incidents come in and checks run.</li>}
        </ul>
      </div>
    </details>
  );
}
