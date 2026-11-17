import { Container } from "./Section";

const anchor = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Plain-language legal pages. The words come from each page unchanged; this only lays them out. */
export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: [string, string[]][] }) {
  return (
    <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[200px_1fr] lg:gap-16">
      <nav aria-label="Sections" className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <ul className="m-0 flex list-none flex-col gap-0.5 border-l border-border p-0">
          {sections.map(([h]) => (
            <li key={h}>
              <a href={`#${anchor(h)}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-callout text-fg-2 no-underline transition-colors duration-150 hover:border-fg-3 hover:text-fg">{h}</a>
            </li>
          ))}
        </ul>
      </nav>
      <article className="min-w-0 max-w-[720px]">
        <h1 className="m-0 text-display-2 font-semibold text-fg">{title}</h1>
        <p className="m-0 mt-4 text-callout text-fg-3">Last updated {updated}.</p>
        <div className="mt-12 flex flex-col">
          {sections.map(([h, paras]) => (
            <section key={h} id={anchor(h)} aria-labelledby={`${anchor(h)}-h`} className="flex scroll-mt-24 flex-col gap-3 border-t border-border-soft py-8">
              <h2 id={`${anchor(h)}-h`} className="m-0 text-title-2 font-semibold text-fg">{h}</h2>
              {paras.map((p, i) => <p key={i} className="m-0 max-w-[68ch] text-body text-fg-2">{p}</p>)}
            </section>
          ))}
        </div>
      </article>
    </Container>
  );
}
