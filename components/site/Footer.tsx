import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { Github } from "@/components/ui/icons";

const COLUMNS: [string, [string, string][]][] = [
  ["Product", [["/product", "Tour"], ["/connect", "Integrations"], ["/agents", "Coding agents"], ["/evidence", "Audit evidence"], ["/pricing", "Pricing"], ["/compare", "Compare"]]],
  ["Learn", [["/docs", "Docs"], ["/changelog", "Changelog"], ["/security", "Security"], ["https://github.com/MaanavKrishna/Aftershock", "Source on GitHub"]]],
  ["Legal", [["/privacy", "Privacy"], ["/terms", "Terms"], ["https://github.com/MaanavKrishna/Aftershock/blob/main/SECURITY.md", "Report a vulnerability"]]],
];

const linkCls = "inline-flex min-h-8 items-center text-ui text-fg-2 no-underline transition-colors duration-150 hover:text-fg";

export function Footer() {
  return (
    <footer className="border-t border-border bg-canvas">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <span className="flex items-center gap-2.5 text-title-3 font-semibold tracking-tight text-fg">
            <LogoMark size={24} accent />
            Aftershock
          </span>
          <p className="m-0 max-w-[30ch] text-callout text-fg-3">Incident memory for your codebase. Open source under Apache 2.0.</p>
          <a href="https://github.com/MaanavKrishna/Aftershock" rel="noopener" aria-label="Aftershock on GitHub" className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border text-fg-2 transition-colors duration-150 hover:bg-s2 hover:text-fg">
            <Github size={18} />
          </a>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:contents">
          {COLUMNS.map(([title, links]) => (
            <nav key={title} aria-label={title} className="flex flex-col gap-1">
              <h2 className="m-0 mb-2 text-callout font-medium text-fg">{title}</h2>
              {links.map(([href, label]) =>
                href.startsWith("http") ? (
                  <a key={href} href={href} rel="noopener" className={linkCls}>{label}</a>
                ) : (
                  <Link key={href} href={href} className={linkCls}>{label}</Link>
                ),
              )}
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-border-soft">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-caption text-fg-3 sm:px-6">
          <span>Free for open source and teams up to five committers.</span>
          <span className="font-mono">Every incident becomes a test.</span>
        </div>
      </div>
    </footer>
  );
}
