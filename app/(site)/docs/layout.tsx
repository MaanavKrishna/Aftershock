import { DOCS, docHref, renderDoc } from "@/lib/docs";
import { DocsSearch, type SearchEntry } from "@/components/site/DocsSearch";
import { DocsNav, type DocsGroup } from "@/components/site/DocsNav";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const entries: SearchEntry[] = [];
  for (const d of DOCS) {
    entries.push({ href: docHref(d.slug), title: d.title });
    for (const h of (await renderDoc(d)).headings) entries.push({ href: `${docHref(d.slug)}#${h.id}`, title: d.title, section: h.text });
  }
  const groups: DocsGroup[] = (["Start", "Guides", "Reference"] as const).map((g) => ({ title: g, items: DOCS.filter((d) => d.group === g).map((d) => ({ href: docHref(d.slug), title: d.title })) }));
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[232px_1fr] lg:gap-12 lg:py-12">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-8">
        <DocsSearch entries={entries} />
        <DocsNav groups={groups} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
