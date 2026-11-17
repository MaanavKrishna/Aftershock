/** The mark: a seismic trace that settles into a check. Follows the theme; `inverted` flips it; `accent` paints the check proven-green. */
export function LogoMark({ size = 28, inverted = false, accent = false }: { size?: number; inverted?: boolean; accent?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[28%] ${inverted ? "bg-canvas text-fg ring-1 ring-border" : "bg-fg text-canvas"}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 13h2l1.6-6 2.6 11 2.1-8.5 1.6 3.5h1.1" />
        <path d="m14.6 13 2.7 2.8 5.2-6.3" className={accent ? "text-proven" : undefined} stroke="currentColor" />
      </svg>
    </span>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} accent />
      <span className="text-title-3 font-semibold text-fg">Aftershock</span>
    </span>
  );
}
