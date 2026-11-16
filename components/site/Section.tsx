import type { ReactNode } from "react";

/** The marketing measure: 1200px, 16px gutters on phones, 24px above. */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-4 sm:px-6 ${className}`}>{children}</div>;
}

/** A full-width band. `tone` changes the surface, never the content width. Sections sit 120px apart (80 on phones). */
export function Band({ id, tone = "canvas", children, className = "", labelledBy }: { id?: string; tone?: "canvas" | "s1" | "sunken"; children: ReactNode; className?: string; labelledBy?: string }) {
  const bg = tone === "s1" ? "bg-s1" : tone === "sunken" ? "bg-sunken" : "bg-canvas";
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${bg} border-t border-border-soft ${className}`}>
      <Container className="py-20 lg:py-30">{children}</Container>
    </section>
  );
}

/** Small label above a section title. Neutral, never a verdict colour. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="m-0 font-mono text-caption uppercase text-fg-3">{children}</p>;
}

/** Section title block. `size="display"` for the home page story, `title` for inner pages. */
export function SectionHead({ title, lede, id, eyebrow, size = "title", align = "start", className = "" }: { title: ReactNode; lede?: ReactNode; id?: string; eyebrow?: ReactNode; size?: "display" | "title"; align?: "start" | "center"; className?: string }) {
  const center = align === "center";
  return (
    <div className={`mb-10 flex max-w-[760px] flex-col gap-4 lg:mb-14 ${center ? "mx-auto items-center text-center" : ""} ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={id} className={`m-0 text-balance font-semibold text-fg ${size === "display" ? "text-display-2" : "text-title-1 md:text-display-2"}`}>
        {title}
      </h2>
      {lede && <p className={`m-0 max-w-[62ch] text-pretty text-lede text-fg-2 ${center ? "mx-auto" : ""}`}>{lede}</p>}
    </div>
  );
}

/** The top of an inner marketing page: eyebrow, the page's one h1, a lede and optional actions. */
export function PageHero({ eyebrow, title, lede, children, narrow = false }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; children?: ReactNode; narrow?: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="hero-spotlight pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70" />
      <Container className={`relative flex flex-col gap-6 pb-16 pt-16 sm:pt-24 lg:pb-20 ${narrow ? "max-w-[860px]" : ""}`}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="m-0 max-w-[20ch] text-balance text-display-2 font-semibold text-fg">{title}</h1>
        {lede && <div className="m-0 max-w-[62ch] text-pretty text-lede text-fg-2">{lede}</div>}
        {children}
      </Container>
    </section>
  );
}
