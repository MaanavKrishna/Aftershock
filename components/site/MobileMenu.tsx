"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { NavLinks } from "./NavLinks";

/** The phone menu: a disclosure that drops a solid sheet under the header and closes after navigating. */
export function MobileMenu({ items }: { items: readonly (readonly [string, string])[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <details ref={ref} className="group lg:hidden">
      <summary aria-label="Menu" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-control text-fg transition-colors duration-150 hover:bg-s2 [&::-webkit-details-marker]:hidden">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
          <path d="M4 8h16M4 16h16" className="group-open:hidden" />
          <path d="M6 6l12 12M18 6 6 18" className="hidden group-open:block" />
        </svg>
      </summary>
      <nav aria-label="Mobile" className="fixed inset-x-0 top-16 flex max-h-[calc(100dvh-4rem)] flex-col gap-1 overflow-y-auto border-b border-border bg-canvas px-4 pb-6 pt-3 shadow-e2">
        <NavLinks items={items} variant="sheet" />
        <Link href="/signin" className="flex min-h-12 items-center rounded-control px-3 text-body font-medium text-fg no-underline hover:bg-s2">Sign in</Link>
        <ButtonLink href="/signin" size="lg" className="mt-3 w-full">Install on GitHub</ButtonLink>
      </nav>
    </details>
  );
}
