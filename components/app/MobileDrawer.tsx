"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** The sidebar as a sheet on small screens. Closes when the route changes. */
export function MobileDrawer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const path = usePathname();
  useEffect(() => ref.current?.close(), [path]);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} aria-label="Open navigation" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-line bg-card text-ink lg:hidden">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <dialog ref={ref} aria-label="Navigation" onClick={(e) => e.target === ref.current && ref.current?.close()} className="m-0 h-full max-h-none w-[min(300px,85vw)] max-w-none border-0 bg-transparent p-0 backdrop:bg-black/50">
        <div className="flex h-full">{children}</div>
      </dialog>
    </>
  );
}
