import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ds/ThemeToggle";
import { DsLink } from "@/components/ds/Button";

export const NAV = [
  ["/product", "Product"],
  ["/agents", "Agents"],
  ["/evidence", "Evidence"],
  ["/connect", "Integrations"],
  ["/pricing", "Pricing"],
  ["/docs", "Docs"],
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 font-display text-[19px] font-semibold tracking-[-0.02em] text-fg no-underline">
          <LogoMark size={28} accent />
          Aftershock
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-control px-3 py-2.5 text-[14.5px] font-medium text-fg-2 no-underline hover:text-fg">{label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Link href="/signin" className="hidden min-h-11 items-center px-3 text-[14.5px] font-semibold text-fg no-underline sm:inline-flex">Sign in</Link>
          <span className="hidden sm:inline-flex"><DsLink href="/signin" className="min-h-10 px-4 text-[14px]">Install on GitHub</DsLink></span>
          <details className="group relative lg:hidden">
            <summary aria-label="Menu" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-control text-fg [&::-webkit-details-marker]:hidden">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" className="group-open:hidden" /><path d="M6 6l12 12M18 6 6 18" className="hidden group-open:block" /></svg>
            </summary>
            <nav aria-label="Mobile" className="fixed inset-x-0 top-16 flex flex-col gap-1 border-b border-rule bg-canvas px-4 pb-5 pt-2 shadow-lift">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="rounded-control px-3 py-3 text-base font-medium text-fg no-underline hover:bg-raised-2">{label}</Link>
              ))}
              <Link href="/signin" className="rounded-control px-3 py-3 text-base font-medium text-fg no-underline hover:bg-raised-2">Sign in</Link>
              <DsLink href="/signin" className="mt-2">Install on GitHub</DsLink>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
