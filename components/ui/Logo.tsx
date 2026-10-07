export function LogoMark({ size = 30, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[7px] ${inverted ? "bg-paper" : "bg-ink"}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={inverted ? "#0E141B" : "#F4F4F1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 13h3.5l2-5 3 10 3-13 2.5 8H22" />
      </svg>
    </span>
  );
}
