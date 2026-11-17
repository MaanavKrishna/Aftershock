import type { Metadata } from "next";
import Link from "next/link";
import { SOURCES, SOURCE_IDS } from "@/lib/integrations/sources";
import { Band, PageHero, SectionHead } from "@/components/site/Section";
import { ArrowRight } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Integrations", description: "Sentry, PagerDuty, incident.io, Linear, Rootly, Opsgenie, Datadog, Jira, a generic signed webhook, Slack and more.", alternates: { canonical: "/connect" } };

const OTHER: [string, string, string][] = [
  ["GitHub", "Issues become incidents, pull requests get one check and one comment, proven tests arrive as pull requests.", "/docs"],
  ["Slack and signed webhooks", "Proofs, blocked pull requests, failing tests and a weekly digest, sent where your team already looks.", "/docs/notifications"],
  ["Claude Code, Cursor and Copilot", "Incident memory for coding agents over MCP, and lessons synced into AGENTS.md.", "/agents"],
  ["GitHub Actions", "Run pull request checks on your own runners with the Aftershock action.", "/docs/api"],
];

const card = "group flex h-full flex-col gap-2 rounded-card border border-border bg-canvas p-5 no-underline transition-colors duration-150 ease-fl hover:border-border-strong hover:bg-s2";

export default function Integrations() {
  return (
    <>
      <PageHero eyebrow="Integrations" title="Incidents come from where you already track them." lede="Alerts and tickets open incidents that wait for their fix. Every delivery is verified by signature or token before anything is stored." />
      <Band tone="s1" labelledBy="sources-h">
        <SectionHead id="sources-h" title="Alert and ticket sources" />
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCE_IDS.map((id) => {
            const s = SOURCES[id];
            return (
              <li key={id}>
                <Link href={`/connect/${id}`} className={card}>
                  <span className="flex items-center gap-2 text-title-3 font-semibold text-fg">
                    {s.label}
                    {s.labs && <span className="inline-flex min-h-5 items-center rounded-full bg-s2 px-2 text-caption font-medium text-fg-2">Labs</span>}
                    <ArrowRight size={16} className="ml-auto text-fg-3 transition-transform duration-150 ease-fl group-hover:translate-x-0.5" />
                  </span>
                  <span className="text-body text-fg-2">{s.text}</span>
                  <span className="mt-auto pt-2 font-mono text-caption text-fg-3">{s.auth === "signature" ? "Signed deliveries" : "Token-authenticated"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Band>
      <Band labelledBy="loop-h">
        <SectionHead id="loop-h" title="And around the loop" />
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          {OTHER.map(([t, d, href]) => (
            <li key={t}>
              <Link href={href} className={`${card} bg-s1`}>
                <span className="flex items-center gap-2 text-title-3 font-semibold text-fg">{t}<ArrowRight size={16} className="ml-auto text-fg-3 transition-transform duration-150 ease-fl group-hover:translate-x-0.5" /></span>
                <span className="text-body text-fg-2">{d}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Band>
    </>
  );
}
