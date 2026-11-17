"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header links that mark the current section with aria-current. */
export function NavLinks({ items, variant }: { items: readonly (readonly [string, string])[]; variant: "bar" | "sheet" }) {
  const path = usePathname() ?? "/";
  return (
    <>
      {items.map(([href, label]) => {
        const current = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={
              variant === "bar"
                ? `inline-flex min-h-9 items-center rounded-full px-3 text-ui font-medium no-underline transition-colors duration-150 ease-fl ${current ? "bg-s2 text-fg" : "text-fg-2 hover:text-fg"}`
                : `flex min-h-12 items-center justify-between rounded-control px-3 text-body font-medium no-underline transition-colors duration-150 ease-fl ${current ? "bg-s2 text-fg" : "text-fg hover:bg-s2"}`
            }
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
