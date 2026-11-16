import Link from "next/link";
import { DOCS, docHref, renderDoc, type DocPage } from "@/lib/docs";
import { ArrowRight } from "@/components/ui/icons";

/** One docs page: rendered markdown, an on-page contents list, previous/next and an edit link. */
export async function DocView({ page }: { page: DocPage }) {
  const { html, headings } = await renderDoc(page);
  const i = DOCS.indexOf(page);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  return (
    <div className="grid gap-10 xl:grid-cols-[1fr_200px]">
      <article className="min-w-0">
        <p className="m-0 mb-3 font-mono text-caption uppercase text-fg-3">{page.group}</p>
        <h1 className="m-0 mb-8 text-balance text-title-1 font-semibold text-fg md:text-display-2">{page.title}</h1>
        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        <nav aria-label="Previous and next" className="mt-16 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link href={docHref(prev.slug)} className="group flex flex-col gap-1 rounded-card border border-border bg-s1 p-4 no-underline transition-colors duration-150 hover:border-border-strong">
              <span className="text-caption text-fg-3">Previous</span>
              <span className="text-ui font-medium text-fg">{prev.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next && (
            <Link href={docHref(next.slug)} className="group flex flex-col items-end gap-1 rounded-card border border-border bg-s1 p-4 text-right no-underline transition-colors duration-150 hover:border-border-strong">
              <span className="text-caption text-fg-3">Next</span>
              <span className="inline-flex items-center gap-1.5 text-ui font-medium text-fg">
                {next.title}
                <ArrowRight size={14} className="text-fg-3 transition-transform duration-150 ease-fl group-hover:translate-x-0.5" />
              </span>
            </Link>
          )}
        </nav>
        <a href={`https://github.com/MaanavKrishna/Aftershock/edit/main/docs/${page.file}`} rel="noopener" className="mt-6 inline-flex min-h-8 items-center text-callout text-fg-3 hover:text-fg">Edit this page on GitHub</a>
      </article>
      {headings.length > 1 && (
        <nav aria-label="On this page" className="hidden xl:sticky xl:top-24 xl:block xl:self-start">
          <h2 className="m-0 mb-3 font-mono text-caption uppercase text-fg-3">On this page</h2>
          <ul className="m-0 flex list-none flex-col gap-0.5 border-l border-border p-0">
            {headings.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-callout text-fg-2 no-underline transition-colors duration-150 hover:border-fg-3 hover:text-fg">{h.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
