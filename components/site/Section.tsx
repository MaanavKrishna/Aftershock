/** A full-width band with the shared 1240px measure. `tone` changes the surface, never the content width. */
export function Band({ id, tone = "canvas", children, className = "" }: { id?: string; tone?: "canvas" | "raised" | "sunken"; children: React.ReactNode; className?: string }) {
  const bg = tone === "raised" ? "bg-raised" : tone === "sunken" ? "bg-sunken" : "bg-canvas";
  return (
    <section id={id} className={`${bg} border-t border-rule ${className}`}>
      <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6 sm:py-24">{children}</div>
    </section>
  );
}

export function SectionHead({ title, lede, id }: { title: string; lede?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-10 flex max-w-[760px] flex-col gap-4">
      <h2 id={id} className="m-0 text-balance font-display text-d2 font-semibold tracking-[-0.03em] text-fg">{title}</h2>
      {lede && <p className="m-0 max-w-[64ch] text-lede text-fg-2">{lede}</p>}
    </div>
  );
}
