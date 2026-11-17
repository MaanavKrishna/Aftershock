import Link from "next/link";
import type { CSSProperties } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/icons";
import { MovingBorder } from "./MovingBorder";
import { Container } from "./Section";

const W = 1200;
const MID = 80;
const QUAKE_FROM = 420;
const FIX_AT = 760;

/** Deterministic jitter so server and client draw the same trace. */
const jitter = (i: number) => Math.sin(i * 12.9898) * 0.5 + Math.sin(i * 4.1414) * 0.5;

function segment(from: number, to: number, amp: (x: number) => number, step = 6): string {
  const pts: string[] = [];
  for (let x = from, i = Math.round(from / step); x <= to; x += step, i++) {
    const a = amp(x);
    const y = MID + (i % 2 ? 1 : -1) * a * (0.65 + 0.35 * Math.abs(jitter(i)));
    pts.push(`${x === from ? "M" : "L"}${x} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
// Quiet production, then the incident with one aftershock, then flat once the fix is proven.
const CALM = segment(0, QUAKE_FROM, (x) => 1.5 + 2.5 * bump(x, 300, 60));
const QUAKE = segment(QUAKE_FROM, FIX_AT, (x) => 3 + 64 * bump(x, 505, 42) + 34 * bump(x, 628, 34) + 6 * bump(x, 720, 30));
const SETTLE = segment(FIX_AT, W, (x) => 3.5 * bump(x, FIX_AT, 40));

const at = (ms: number) => ({ "--trace-delay": `${ms}ms` }) as CSSProperties;
const pct = (x: number) => `${(x / W) * 100}%`;

const HEADLINE = [["Every", "incident", "becomes", "a", "test."], ["Git", "history", "proves", "it."]];

/** Home hero: dot grid, a soft spotlight, the headline revealed once, and a seismograph that spikes at the incident and settles proven-green. */
export function SeismicHero({ version }: { version?: string }) {
  let n = 0;
  return (
    <section aria-labelledby="hero-h" className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden="true" className="hero-spotlight pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px]" />
      <Container className="flex flex-col items-center gap-7 pt-16 text-center sm:pt-24 lg:pt-28">
        {version && (
          <Link href="/changelog" className="group inline-flex min-h-8 items-center gap-2 rounded-full border border-border bg-s1 py-1 pl-1 pr-3 text-callout text-fg-2 no-underline shadow-e1 transition-colors duration-150 hover:text-fg">
            <span className="rounded-full bg-s2 px-2 py-0.5 font-mono text-caption text-fg">v{version}</span>
            Open source, Apache 2.0
            <ArrowRight size={14} className="transition-transform duration-150 ease-fl group-hover:translate-x-0.5" />
          </Link>
        )}
        <h1 id="hero-h" className="m-0 max-w-[16ch] text-balance text-display-1 font-semibold text-fg sm:max-w-none">
          {HEADLINE.map((line, li) => (
            <span key={li} className={`sm:block ${li === 1 ? "text-fg-2" : ""}`}>
              {li === 1 && " "}
              {line.map((w, wi) => (
                <span key={w}>
                  <span className="word-reveal" style={{ "--word-delay": `${80 + n++ * 55}ms` } as CSSProperties}>{w}</span>
                  {wi < line.length - 1 && " "}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p className="m-0 max-w-[58ch] text-pretty text-lede text-fg-2">
          Aftershock reads an incident and the commit that fixed it, drafts a regression test, and keeps it only if it fails before the fix and passes on it. From then on it runs on every pull request, so the same outage can’t ship twice.
        </p>
        <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          <MovingBorder>
            <ButtonLink href="/signin" size="lg" className="w-full">Install on GitHub</ButtonLink>
          </MovingBorder>
          <ButtonLink href="/product" size="lg" variant="secondary">How a proof works</ButtonLink>
        </div>
        <p className="m-0 text-callout text-fg-3">Free for open source and teams up to five committers.</p>
      </Container>

      <Container className="pb-16 pt-14 sm:pb-24 sm:pt-20">
        <figure className="relative m-0" aria-label="A seismograph of one incident: quiet production, a spike when INC-12 hits, and a flat line once its test is proven on the fix commit.">
          <div className="relative h-40">
            <svg viewBox={`0 0 ${W} 160`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
              <line x1="0" x2={W} y1={MID} y2={MID} className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1={FIX_AT} x2={FIX_AT} y1="8" y2="152" className="trace-mark stroke-border-strong" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" style={at(1850)} />
              <path d={CALM} pathLength={1} fill="none" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="trace-draw stroke-fg-3" style={{ "--trace-delay": "250ms", "--trace-dur": "700ms" } as CSSProperties} />
              <path
                d={QUAKE}
                pathLength={1}
                fill="none"
                strokeWidth="1.75"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="trace-draw stroke-recur"
                style={{ "--trace-delay": "950ms", "--trace-dur": "900ms", filter: "drop-shadow(0 0 6px color-mix(in oklab, var(--fl-recur) 45%, transparent))" } as CSSProperties}
              />
              <path
                d={SETTLE}
                pathLength={1}
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="trace-draw stroke-proven"
                style={{ "--trace-delay": "1850ms", "--trace-dur": "800ms", "--trace-ease": "cubic-bezier(.22,1,.36,1)", filter: "drop-shadow(0 0 5px color-mix(in oklab, var(--fl-proven) 40%, transparent))" } as CSSProperties}
              />
            </svg>
            <span aria-hidden="true" className="trace-mark absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 translate-x-1/2 rounded-full bg-proven-soft" style={at(2550)}>
              <span className="absolute inset-[6px] rounded-full bg-proven" />
            </span>
          </div>
          <figcaption className="relative mt-4 h-12 text-left font-mono text-caption">
            <span className="trace-label absolute left-0 top-0 hidden text-fg-3 md:block" style={at(400)}>main · quiet</span>
            <span className="trace-label absolute top-0 -translate-x-1/2 whitespace-nowrap text-recur" style={{ left: pct(505), ...at(1150) }}>
              INC-12 hits
            </span>
            <span className="trace-label absolute top-0 hidden -translate-x-1/2 whitespace-nowrap text-fg-2 sm:block" style={{ left: pct(FIX_AT), ...at(1850) }}>
              fix aa86f56
            </span>
            <span className="trace-label absolute right-0 top-0 whitespace-nowrap text-right text-proven" style={at(2450)}>
              test proven, guarding
            </span>
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
