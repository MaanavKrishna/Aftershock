import { ImageResponse } from "next/og";

export const alt = "Aftershock: every incident becomes a test. Git history proves it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The image renderer can't read CSS variables, so these are the Fault Line dark-theme token values
 * from app/globals.css: canvas, s1, border-strong, fg, fg-2, fg-3, recur, proven. The logo tile is inverted (fg),
 * so its check uses the light-theme proven value.
 */
const T = { canvas: "#08090C", s1: "#0F1115", line: "rgba(255,255,255,0.14)", fg: "#EDEFF3", fg2: "#A9B0BC", fg3: "#828A98", recur: "#FF7A45", proven: "#3DD68C", provenOnLight: "#16794A" };

const W = 1040;
const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
function seg(from: number, to: number, amp: (x: number) => number) {
  const pts: string[] = [];
  for (let x = from, i = 0; x <= to; x += 6, i++) pts.push(`${x === from ? "M" : "L"}${x} ${(60 + (i % 2 ? 1 : -1) * amp(x)).toFixed(1)}`);
  return pts.join(" ");
}

/** Social card: the seismic trace spiking at the incident, then settling proven-green. */
export default function OpenGraph() {
  const calm = seg(0, 360, () => 2);
  const quake = seg(360, 660, (x) => 3 + 50 * bump(x, 440, 38) + 26 * bump(x, 550, 30));
  const settle = seg(660, W, (x) => 3 * bump(x, 660, 30));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: T.canvas, backgroundImage: `radial-gradient(circle at 50% 0%, ${T.s1}, ${T.canvas} 70%)`, color: T.fg, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 32, fontWeight: 600 }}>
          <div style={{ display: "flex", width: 52, height: 52, borderRadius: 14, background: T.fg, alignItems: "center", justifyContent: "center" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.5 13h2l1.6-6 2.6 11 2.1-8.5 1.6 3.5h1.1" stroke={T.canvas} />
              <path d="m14.6 13 2.7 2.8 5.2-6.3" stroke={T.provenOnLight} />
            </svg>
          </div>
          Aftershock
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.04 }}>
          <span>Every incident becomes a test.</span>
          <span style={{ color: T.fg2 }}>Git history proves it.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <svg width={W} height="120" viewBox={`0 0 ${W} 120`}>
            <line x1="0" x2={W} y1="60" y2="60" stroke={T.line} strokeWidth="1" />
            <path d={calm} fill="none" stroke={T.fg3} strokeWidth="2" />
            <path d={quake} fill="none" stroke={T.recur} strokeWidth="2.5" />
            <path d={settle} fill="none" stroke={T.proven} strokeWidth="3" />
            <circle cx={W - 6} cy="60" r="6" fill={T.proven} />
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: T.fg3 }}>
            <span style={{ color: T.recur }}>INC-12 hits</span>
            <span style={{ color: T.proven }}>test proven, guarding</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
