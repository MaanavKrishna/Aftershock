"use client";
import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const NEXT: Record<Mode, Mode> = { system: "dark", dark: "light", light: "system" };
const LABEL: Record<Mode, string> = { system: "Theme: system", dark: "Theme: dark", light: "Theme: light" };

/** Cycles system → dark → light. The choice is kept in this browser only. */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("as-theme");
      if (t === "light" || t === "dark") setMode(t);
    } catch {
      /* storage blocked: stay on system */
    }
  }, []);
  const apply = (m: Mode) => {
    setMode(m);
    try {
      if (m === "system") localStorage.removeItem("as-theme");
      else localStorage.setItem("as-theme", m);
    } catch {
      /* storage blocked: the choice lasts for this page only */
    }
    if (m === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = m;
  };
  return (
    <button type="button" onClick={() => apply(NEXT[mode])} aria-label={`${LABEL[mode]}. Change theme`} title={LABEL[mode]} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-fg-2 hover:text-fg">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        {mode === "dark" ? <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /> : mode === "light" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> : <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></>}
      </svg>
    </button>
  );
}
