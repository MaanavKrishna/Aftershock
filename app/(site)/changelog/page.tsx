import type { Metadata } from "next";
import { releases } from "@/lib/docs/changelog";
import { Container } from "@/components/site/Section";

export const metadata: Metadata = { title: "Changelog", description: "Every Aftershock release.", alternates: { canonical: "/changelog", types: { "application/rss+xml": "/changelog.xml" } } };

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function Changelog() {
  const all = await releases();
  return (
    <Container width="narrow" className="py-16 sm:py-24">
      <div className="flex flex-col gap-5">
        <h1 className="m-0 text-display-2 font-semibold text-fg">Changelog</h1>
        <p className="m-0 text-lede text-fg-2">
          Every release, newest first. <a href="/changelog.xml" className="text-signal">RSS feed</a>.
        </p>
      </div>
      <div className="relative mt-14">
      <span aria-hidden="true" className="absolute bottom-0 left-[5px] top-2 w-px bg-border md:left-[171px]" />
      <ol className="relative m-0 list-none p-0">
        {all.map((r, i) => (
          <li key={r.version} id={`v${r.version}`} aria-labelledby={`v${r.version}-h`} className="relative grid scroll-mt-24 gap-4 pb-16 pl-8 md:grid-cols-[172px_1fr] md:gap-10 md:pl-0">
            <span aria-hidden="true" className={`absolute left-0 top-2 h-[11px] w-[11px] rounded-full border-2 border-canvas md:left-[166px] ${i === 0 ? "bg-fg" : "bg-border-strong"}`} />
            <div className="flex flex-col gap-2 md:sticky md:top-24 md:self-start md:pr-8 md:text-right">
              <time dateTime={r.date} className="text-callout text-fg-3">{fmt(r.date)}</time>
            </div>
            <div className="min-w-0 md:pl-4">
              <h2 id={`v${r.version}-h`} className="m-0 mb-5 flex items-center gap-3">
                <a href={`#v${r.version}`} className="inline-flex min-h-7 items-center rounded-full border border-border-strong bg-s1 px-3 font-mono text-callout font-medium text-fg no-underline shadow-e1 hover:bg-s2">v{r.version}</a>
                {i === 0 && <span className="text-caption font-medium text-fg-3">Latest</span>}
              </h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: r.html }} />
            </div>
          </li>
        ))}
      </ol>
      </div>
    </Container>
  );
}
