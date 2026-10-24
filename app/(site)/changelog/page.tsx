import type { Metadata } from "next";
import { releases } from "@/lib/docs/changelog";

export const metadata: Metadata = { title: "Changelog", description: "Every Aftershock release.", alternates: { canonical: "/changelog", types: { "application/rss+xml": "/changelog.xml" } } };

export default async function Changelog() {
  const all = await releases();
  return (
    <section className="mx-auto max-w-[900px] px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="m-0 font-display text-d1 font-semibold tracking-[-0.03em] text-fg">Changelog</h1>
      <p className="mt-5 text-lede text-fg-2">Every release, newest first. <a href="/changelog.xml" className="text-signal">RSS feed</a>.</p>
      <ol className="m-0 mt-12 list-none p-0">
        {all.map((r) => (
          <li key={r.version} id={`v${r.version}`} className="grid gap-4 border-t border-rule py-10 md:grid-cols-[180px_1fr]">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 font-display text-[26px] font-semibold tracking-[-0.02em] text-fg">v{r.version}</h2>
              <time dateTime={r.date} className="text-[14px] text-fg-3">{new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time>
            </div>
            <div className="prose" dangerouslySetInnerHTML={{ __html: r.html }} />
          </li>
        ))}
      </ol>
    </section>
  );
}
