import type { Metadata } from "next";
import { Band, SectionHead } from "@/components/site/Section";

export const metadata: Metadata = { title: "Compare", description: "How Aftershock differs from AI test generators, code review bots and incident platforms.", alternates: { canonical: "/compare" } };

const KINDS: { title: string; examples: string; does: string; differs: string; together: string }[] = [
  { title: "AI test generators and AI debugging", examples: "Assistants that write tests or propose fixes from an error", does: "Generate tests or fixes quickly, often from a stack trace or a diff.", differs: "Aftershock keeps a test only after it fails on the commit before the fix and passes on the fix, three runs each, and then runs it on every relevant pull request from then on.", together: "Use them to write code; use Aftershock to prove which tests actually capture an incident." },
  { title: "Code review bots", examples: "Bots that comment on pull requests", does: "Read a diff and give an opinion about it.", differs: "Aftershock’s check is the result of running proven tests. A Recur verdict means a test that once reproduced a real incident failed again.", together: "Reviews catch new problems; Aftershock stops old ones coming back." },
  { title: "Incident management platforms", examples: "PagerDuty, incident.io, Rootly, Opsgenie", does: "Page people, coordinate the response and record the postmortem.", differs: "Aftershock starts where they stop: it turns the postmortem into an executable test tied to the fix.", together: "Connect them as alert sources. Incidents open in Aftershock and wait for their fix." },
  { title: "Error monitoring", examples: "Sentry, Datadog", does: "Detect errors in production and group them.", differs: "Aftershock doesn’t detect errors. It remembers the ones you fixed and guards against them in review.", together: "Connect them as alert sources; a merged pull request that changes the files an alert points at is suggested as its fix." },
];

export default function Compare() {
  return (
    <>
      <section className="mx-auto max-w-[1240px] px-4 pb-14 pt-16 sm:px-6 sm:pt-20">
        <h1 className="m-0 max-w-[20ch] text-balance font-display text-d1 font-semibold tracking-[-0.03em] text-fg">Where Aftershock fits next to what you already use.</h1>
        <p className="mt-6 max-w-[62ch] text-lede text-fg-2">Aftershock does one thing the others don’t: it proves a lesson against your own git history, then guards every pull request with it. Most teams use it alongside these tools, not instead of them.</p>
        <p className="mt-3 text-[14px] text-fg-3">Last checked 24 October 2026. Products change; tell us on GitHub if something here is out of date.</p>
      </section>
      <Band tone="raised">
        <SectionHead title="By kind of tool" />
        <div className="flex flex-col">
          {KINDS.map((k) => (
            <article key={k.title} className="grid gap-4 border-t border-rule py-8 lg:grid-cols-[1fr_2fr]">
              <div className="flex flex-col gap-1"><h3 className="m-0 font-display text-d3 font-semibold text-fg">{k.title}</h3><p className="m-0 text-[14px] text-fg-3">{k.examples}</p></div>
              <dl className="m-0 grid gap-4 sm:grid-cols-3">
                {[["What they do", k.does], ["What’s different", k.differs], ["Together", k.together]].map(([t, d]) => <div key={t} className="flex flex-col gap-1"><dt className="text-[13px] font-semibold text-fg-3">{t}</dt><dd className="m-0 text-[15px] text-fg-2">{d}</dd></div>)}
              </dl>
            </article>
          ))}
        </div>
      </Band>
    </>
  );
}
