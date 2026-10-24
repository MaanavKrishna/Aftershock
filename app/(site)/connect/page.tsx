import type { Metadata } from "next";
import Link from "next/link";
import { SOURCES, SOURCE_IDS } from "@/lib/integrations/sources";
import { Band, SectionHead } from "@/components/site/Section";

export const metadata: Metadata = { title: "Integrations", description: "Sentry, PagerDuty, incident.io, Linear, Rootly, Opsgenie, Datadog, Jira, a generic signed webhook, Slack and more.", alternates: { canonical: "/connect" } };

const OTHER: [string, string, string][] = [
  ["GitHub", "Issues become incidents, pull requests get one check and one comment, proven tests arrive as pull requests.", "/docs"],
  ["Slack and signed webhooks", "Proofs, blocked pull requests, failing tests and a weekly digest, sent where your team already looks.", "/docs/notifications"],
  ["Claude Code, Cursor and Copilot", "Incident memory for coding agents over MCP, and lessons synced into AGENTS.md.", "/agents"],
  ["GitHub Actions", "Run pull request checks on your own runners with the Aftershock action.", "/docs/api"],
];

export default function Integrations() {
  return (
    <>
      <section className="mx-auto max-w-[1240px] px-4 pb-14 pt-16 sm:px-6 sm:pt-20">
        <h1 className="m-0 max-w-[18ch] text-balance font-display text-d1 font-semibold tracking-[-0.03em] text-fg">Incidents come from where you already track them.</h1>
        <p className="mt-6 max-w-[60ch] text-lede text-fg-2">Alerts and tickets open incidents that wait for their fix. Every delivery is verified by signature or token before anything is stored.</p>
      </section>
      <Band tone="raised">
        <SectionHead title="Alert and ticket sources" />
        <ul className="m-0 grid list-none gap-x-10 p-0 md:grid-cols-2">
          {SOURCE_IDS.map((id) => {
            const s = SOURCES[id];
            return (
              <li key={id} className="border-t border-rule">
                <Link href={`/connect/${id}`} className="flex flex-col gap-1 py-4 no-underline">
                  <span className="flex items-center gap-2 text-[17px] font-semibold text-fg">{s.label}{s.labs && <span className="rounded-chip bg-raised-2 px-2 py-0.5 text-[12px] font-medium text-fg-3">Labs</span>}</span>
                  <span className="text-[15px] text-fg-2">{s.text}</span>
                  <span className="text-[13px] text-fg-3">{s.auth === "signature" ? "Signed deliveries" : "Token-authenticated"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Band>
      <Band>
        <SectionHead title="And around the loop" />
        <ul className="m-0 grid list-none gap-x-10 p-0 md:grid-cols-2">
          {OTHER.map(([t, d, href]) => (
            <li key={t} className="border-t border-rule">
              <Link href={href} className="flex flex-col gap-1 py-4 no-underline"><span className="text-[17px] font-semibold text-fg">{t}</span><span className="text-[15px] text-fg-2">{d}</span></Link>
            </li>
          ))}
        </ul>
      </Band>
    </>
  );
}
