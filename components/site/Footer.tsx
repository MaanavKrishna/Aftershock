import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";

const COLUMNS: [string, [string, string][]][] = [
  ["Product", [["/product", "Tour"], ["/connect", "Integrations"], ["/agents", "Coding agents"], ["/evidence", "Audit evidence"], ["/pricing", "Pricing"], ["/compare", "Compare"]]],
  ["Learn", [["/docs", "Docs"], ["/changelog", "Changelog"], ["/security", "Security"], ["https://github.com/MaanavKrishna/Aftershock", "Source on GitHub"]]],
  ["Legal", [["/privacy", "Privacy"], ["/terms", "Terms"], ["https://github.com/MaanavKrishna/Aftershock/blob/main/SECURITY.md", "Report a vulnerability"]]],
];

export function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-10 px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2.5 font-display text-[17px] font-semibold text-fg"><LogoMark size={24} accent />Aftershock</span>
          <p className="m-0 max-w-[260px] text-[14px] text-fg-3">Incident memory for your codebase. Open source under Apache 2.0.</p>
        </div>
        {COLUMNS.map(([title, links]) => (
          <nav key={title} aria-label={title} className="flex flex-col gap-1">
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-fg">{title}</h2>
            {links.map(([href, label]) =>
              href.startsWith("http") ? (
                <a key={href} href={href} rel="noopener" className="py-1.5 text-[14px] text-fg-3 no-underline hover:text-fg">{label}</a>
              ) : (
                <Link key={href} href={href} className="py-1.5 text-[14px] text-fg-3 no-underline hover:text-fg">{label}</Link>
              ),
            )}
          </nav>
        ))}
      </div>
    </footer>
  );
}
