/** The mark: a seismic trace that settles into a check. Inverted for dark surfaces. */
export function LogoMark({ size = 30, inverted = false, accent = false }: { size?: number; inverted?: boolean; accent?: boolean }) {
  const ink = inverted ? "#0A0E14" : "#F5F7FA";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-[7px] ${inverted ? "bg-[#F5F7FA]" : "bg-[#0A0E14]"} ${accent ? "ring-1 ring-rule-strong" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 13h2l1.6-6 2.6 11 2.1-8.5 1.6 3.5h1.1" stroke={ink} />
        <path d="m14.6 13 2.7 2.8 5.2-6.3" stroke={accent ? "#38BDF8" : ink} />
      </svg>
    </span>
  );
}
