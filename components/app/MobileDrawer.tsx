"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "@/components/ui/icons";

/** The sidebar as a sheet from the left on phones. Native <dialog>: focus trap and Escape for free. Closes on navigation. */
export function MobileDrawer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const path = usePathname();
  useEffect(() => ref.current?.close(), [path]);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label="Open navigation"
        className="-ml-1.5 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-2 hover:bg-s2 hover:text-fg md:hidden"
      >
        <Menu size={18} />
      </button>
      <dialog
        ref={ref}
        aria-label="Navigation"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="m-0 h-dvh max-h-none w-[min(280px,85vw)] max-w-none border-0 bg-transparent p-0 text-fg shadow-e2 backdrop:bg-black/40 open:animate-[fl-in_200ms_var(--ease-fl)]"
      >
        <div className="flex h-full bg-canvas">{children}</div>
      </dialog>
    </>
  );
}
