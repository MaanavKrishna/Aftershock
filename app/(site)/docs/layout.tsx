import Link from "next/link";
import { DOCS, docHref, renderDoc } from "@/lib/docs";
import { DocsSearch, type SearchEntry } from "@/components/site/DocsSearch";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const entries: SearchEntry[] = [];
  for (const d of DOCS) {
    entries.push({ href: docHref(d.slug), title: d.title });
    for (const h of (await renderDoc(d)).headings) entries.push({ href: `${docHref(d.slug)}#${h.id}`, title: d.title, section: h.text });
  }
  const groups = ["Start", "Guides", "Reference"] as const;
  return (
    <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
        <DocsSearch entries={entries} />
        <nav aria-label="Docs" className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g} className="flex flex-col gap-0.5">
              <h2 className="m-0 mb-1 px-2 text-[13px] font-semibold text-fg-3">{g}</h2>
              {DOCS.filter((d) => d.group === g).map((d) => (
                <Link key={d.slug} href={docHref(d.slug)} className="rounded-chip px-2 py-1.5 text-[14.5px] text-fg-2 no-underline hover:bg-raised-2 hover:text-fg">{d.title}</Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
