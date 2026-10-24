import Link from "next/link";
import { DOCS, docHref, renderDoc, type DocPage } from "@/lib/docs";

/** One docs page: rendered markdown, an on-page contents list, previous/next and an edit link. */
export async function DocView({ page }: { page: DocPage }) {
  const { html, headings } = await renderDoc(page);
  const i = DOCS.indexOf(page);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  return (
    <div className="grid gap-10 xl:grid-cols-[1fr_200px]">
      <article className="min-w-0">
        <h1 className="m-0 mb-6 font-display text-d2 font-semibold tracking-[-0.03em] text-fg">{page.title}</h1>
        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="mt-14 flex flex-wrap justify-between gap-4 border-t border-rule pt-6 text-[14.5px]">
          {prev ? <Link href={docHref(prev.slug)} className="flex flex-col no-underline"><span className="text-[13px] text-fg-3">Previous</span><span className="font-semibold text-fg">{prev.title}</span></Link> : <span />}
          {next && <Link href={docHref(next.slug)} className="flex flex-col items-end no-underline"><span className="text-[13px] text-fg-3">Next</span><span className="font-semibold text-fg">{next.title}</span></Link>}
        </div>
        <a href={`https://github.com/MaanavKrishna/Aftershock/edit/main/docs/${page.file}`} rel="noopener" className="mt-6 inline-block text-[13.5px] text-fg-3">Edit this page on GitHub</a>
      </article>
      {headings.length > 1 && (
        <nav aria-label="On this page" className="hidden xl:sticky xl:top-24 xl:block xl:self-start">
          <h2 className="m-0 mb-2 text-[13px] font-semibold text-fg-3">On this page</h2>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13.5px]">
            {headings.map((h) => <li key={h.id}><a href={`#${h.id}`} className="text-fg-2 no-underline hover:text-fg">{h.text}</a></li>)}
          </ul>
        </nav>
      )}
    </div>
  );
}
