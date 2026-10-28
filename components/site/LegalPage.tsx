/** Plain-language legal pages. */
export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: [string, string[]][] }) {
  return (
    <section className="mx-auto max-w-[760px] px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="m-0 font-display text-d1 font-semibold tracking-[-0.03em] text-fg">{title}</h1>
      <p className="mt-4 text-[14px] text-fg-3">Last updated {updated}.</p>
      <div className="mt-10 flex flex-col gap-9">
        {sections.map(([h, paras]) => (
          <div key={h} className="flex flex-col gap-3">
            <h2 className="m-0 font-display text-[22px] font-semibold tracking-[-0.01em] text-fg">{h}</h2>
            {paras.map((p, i) => <p key={i} className="m-0 max-w-[68ch] text-fg-2">{p}</p>)}
          </div>
        ))}
      </div>
    </section>
  );
}
