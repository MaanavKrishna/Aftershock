import { ImageResponse } from "next/og";

export const alt = "Aftershock: every incident becomes a test. Git history proves it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card: the seismic trace settling into a proven check. */
export default function OpenGraph() {
  const pts = Array.from({ length: 61 }, (_, i) => {
    const burst = Math.exp(-((i - 22) ** 2) / 40) + 0.6 * Math.exp(-((i - 41) ** 2) / 26);
    const amp = i > 48 ? 1 : 4 + 26 * burst;
    return `${i === 0 ? "M" : "L"}${(i / 60) * 1040} ${60 + Math.sin(i * 1.7) * amp * (i % 2 ? 1 : -0.8)}`;
  }).join(" ");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#0A0E14", color: "#E8EDF3", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 600 }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 13h2l1.6-6 2.6 11 2.1-8.5 1.6 3.5h1.1" stroke="#E8EDF3" /><path d="m14.6 13 2.7 2.8 5.2-6.3" stroke="#38BDF8" /></svg>
          Aftershock
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05, maxWidth: 980 }}>Every incident becomes a test. Git history proves it.</div>
        <svg width="1040" height="120" viewBox="0 0 1040 120"><path d={pts} fill="none" stroke="#38BDF8" strokeWidth="3" /></svg>
      </div>
    ),
    size,
  );
}
