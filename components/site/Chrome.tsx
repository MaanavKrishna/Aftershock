import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";

const LINKS = [["/#how", "How it works"], ["/#pr", "Pull requests"], ["/security", "Security"], ["/pricing", "Pricing"], ["/docs", "Docs"]] as const;

export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="border-b border-[#DCDDD8] bg-site">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 text-[19px] font-bold tracking-[-0.02em] text-ink no-underline">
          <LogoMark />
          Aftershock
        </Link>
        <nav aria-label="Main" className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-medium">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={current === href ? "page" : undefined} className={`py-2.5 no-underline ${current === href ? "font-semibold text-ink" : "text-body hover:text-ink"}`}>{label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/signin" className="inline-flex min-h-11 items-center px-3.5 text-sm font-semibold text-ink no-underline">Sign in</Link>
          <Link href="/signin" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-[18px] text-sm font-semibold text-white no-underline">Connect GitHub</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[#DCDDD8]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-7 text-[13px] text-muted">
        <span className="font-semibold text-ink">Aftershock</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          {[["/docs", "Docs"], ["/pricing", "Pricing"], ["/security", "Security"], ["/", "Home"]].map(([h, l]) => <Link key={h} href={h} className="py-2 text-muted no-underline hover:text-ink">{l}</Link>)}
        </nav>
        <span className="font-mono">AI drafts · Git history proves · Humans merge</span>
      </div>
    </footer>
  );
}

export const eyebrow = "font-mono text-[13px] text-muted";
export const h2 = "m-0 text-[clamp(30px,3.6vw,46px)] font-semibold leading-[1.08] tracking-[-0.03em]";
