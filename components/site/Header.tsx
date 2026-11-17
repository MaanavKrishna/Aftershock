import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ButtonLink } from "@/components/ui/Button";
import { NavLinks } from "./NavLinks";
import { MobileMenu } from "./MobileMenu";

export const NAV = [
  ["/product", "Product"],
  ["/agents", "Agents"],
  ["/evidence", "Evidence"],
  ["/connect", "Integrations"],
  ["/pricing", "Pricing"],
  ["/docs", "Docs"],
] as const;

/** Glass header: wordmark, sections, theme, sign in and the install link. */
export function Header() {
  return (
    <header className="glass sticky top-0 z-30 border-b border-border">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Aftershock home" className="-ml-1 flex min-h-11 items-center gap-2.5 rounded-control px-1 text-fg no-underline">
          <LogoMark size={26} accent />
          <span className="text-title-3 font-semibold tracking-tight">Aftershock</span>
        </Link>
        <nav aria-label="Main" className="ml-4 hidden flex-1 items-center gap-0.5 lg:flex">
          <NavLinks items={NAV} variant="bar" />
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Link href="/signin" className="hidden min-h-10 items-center rounded-control px-3 text-ui font-medium text-fg-2 no-underline transition-colors duration-150 hover:text-fg sm:inline-flex">Sign in</Link>
          <span className="ml-1 hidden sm:inline-flex">
            <ButtonLink href="/signin" size="sm">Install on GitHub</ButtonLink>
          </span>
          <MobileMenu items={NAV} />
        </div>
      </div>
    </header>
  );
}
