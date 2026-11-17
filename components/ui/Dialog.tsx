"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Cross } from "./icons";

/**
 * A modal on the native <dialog> element: focus trap, Escape and the inert background come from the browser.
 * `side` turns it into a sheet that slides in from the right (or up on phones).
 */
export function Dialog({ open, onClose, title, description, children, side = false }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; side?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`glass m-0 border border-border p-0 text-fg shadow-e2 backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-[fl-in_200ms_var(--ease-fl)] ${side ? "ml-auto h-dvh max-h-dvh w-[min(420px,100vw)] max-w-none rounded-l-stage" : "mx-auto mt-[12vh] w-[min(560px,calc(100vw-32px))] rounded-stage"}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border-soft px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-title-3 font-semibold">{title}</h2>
          {description && <p className="m-0 text-callout text-fg-3">{description}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-m-1.5 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-control text-fg-3 hover:bg-s2 hover:text-fg">
          <Cross size={16} />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
