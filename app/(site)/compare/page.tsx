import type { Metadata } from "next";
import { Check, Cross, Half } from "@/components/ui/icons";
import { Band, PageHero, SectionHead } from "@/components/site/Section";

export const metadata: Metadata = { title: "Compare", description: "How Aftershock differs from AI test generators, code review bots and incident platforms.", alternates: { canonical: "/compare" } };

const KINDS: { title: string; examples: string; does: string; differs: string; together: string }[] = [
  { title: "AI test generators and AI debugging", examples: "Assistants that write tests or propose fixes from an error", does: "Generate tests or fixes quickly, often from a stack trace or a diff.", differs: "Aftershock keeps a test only after it fails on the commit before the fix and passes on the fix, three runs each, and then runs it on every relevant pull request from then on.", together: "Use them to write code; use Aftershock to prove which tests actually capture an incident." },
  { title: "Code review bots", examples: "Bots that comment on pull requests", does: "Read a diff and give an opinion about it.", differs: "Aftershock’s check is the result of running proven tests. A Recur verdict means a test that once reproduced a real incident failed again.", together: "Reviews catch new problems; Aftershock stops old ones coming back." },
  { title: "Incident management platforms", examples: "PagerDuty, incident.io, Rootly, Opsgenie", does: "Page people, coordinate the response and record the postmortem.", differs: "Aftershock starts where they stop: it turns the postmortem into an executable test tied to the fix.", together: "Connect them as alert sources. Incidents open in Aftershock and wait for their fix." },
  { title: "Error monitoring", examples: "Sentry, Datadog", does: "Detect errors in production and group them.", differs: "Aftershock doesn’t detect errors. It remembers the ones you fixed and guards against them in review.", together: "Connect them as alert sources; a merged pull request that changes the files an alert points at is suggested as its fix." },
];

type Mark = "yes" | "no" | "partly";
const TABLE: [string, Mark, Mark, Mark, Mark][] = [
  ["Test is proven against git history (fails before the fix, passes on it)", "yes", "no", "no", "no"],
  ["Runs on every relevant pull request", "yes", "partly", "yes", "no"],
  ["Plain test file you keep if you leave", "yes", "yes", "no", "no"],
  ["Finds the commit that introduced the bug", "yes", "no", "no", "no"],
  ["Signed evidence for audits", "yes", "no", "no", "partly"],
];
const MARKS: Record<Mark, { Icon: typeof Check; word: string; cls: string }> = {
  yes: { Icon: Check, word: "Yes", cls: "text-fg" },
  no: { Icon: Cross, word: "No", cls: "text-fg-3" },
  partly: { Icon: Half, word: "Partly", cls: "text-fg-2" },
};

export default function Compare() {
  return (
    <>
      <PageHero eyebrow="Compare" title="Where Aftershock fits next to what you already use." lede={<>
        <p className="m-0">Aftershock does one thing the others don’t: it proves a lesson against your own git history, then guards every pull request with it. Most teams use it alongside these tools, not instead of them.</p>
        <p className="m-0 mt-4 text-callout text-fg-3">Last checked 24 October 2026. Products change; tell us on GitHub if something here is out of date.</p>
      </>} />
      <Band labelledBy="table-h">
        <SectionHead id="table-h" title="Proof, not opinion." lede="AI test generators write tests nobody checked against history. Review bots comment. Incident tools stop at the postmortem. Aftershock is the part that makes the lesson executable." />
        <div className="overflow-x-auto rounded-card border border-border bg-s1 shadow-e1">
          <table className="w-full min-w-[720px] border-collapse text-left text-ui">
            <caption className="sr-only">How Aftershock compares with other kinds of tools</caption>
            <thead>
              <tr className="border-b border-border bg-s2 text-callout text-fg-2">
                <th scope="col" className="px-5 py-3 font-medium">What you get</th>
                <th scope="col" className="px-5 py-3 font-semibold text-fg">Aftershock</th>
                <th scope="col" className="px-5 py-3 font-medium">AI test generators</th>
                <th scope="col" className="px-5 py-3 font-medium">Code review bots</th>
                <th scope="col" className="px-5 py-3 font-medium">Incident platforms</th>
              </tr>
            </thead>
            <tbody>
              {TABLE.map(([what, ...cells]) => (
                <tr key={what} className="border-t border-border-soft first:border-t-0">
                  <th scope="row" className="max-w-[340px] px-5 py-4 font-medium text-fg">{what}</th>
                  {cells.map((c, j) => {
                    const m = MARKS[c];
                    return (
                      <td key={j} className={`px-5 py-4 ${m.cls} ${j === 0 ? "bg-s2/60 font-medium" : ""}`}>
                        <span className="inline-flex items-center gap-1.5"><m.Icon size={14} />{m.word}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Band>
      <Band tone="s1" labelledBy="kinds-h">
        <SectionHead id="kinds-h" title="By kind of tool" />
        <div className="flex flex-col gap-4">
          {KINDS.map((k) => (
            <article key={k.title} className="grid gap-6 rounded-stage border border-border bg-canvas p-6 sm:p-8 lg:grid-cols-[1fr_2.2fr]">
              <div className="flex flex-col gap-1.5">
                <h3 className="m-0 text-title-2 font-semibold text-fg">{k.title}</h3>
                <p className="m-0 text-callout text-fg-3">{k.examples}</p>
              </div>
              <dl className="m-0 grid gap-6 sm:grid-cols-3">
                {[["What they do", k.does], ["What’s different", k.differs], ["Together", k.together]].map(([t, d], j) => (
                  <div key={t} className={`flex flex-col gap-1.5 ${j === 1 ? "sm:border-x sm:border-border-soft sm:px-6" : ""}`}>
                    <dt className={`text-callout font-medium ${j === 1 ? "text-fg" : "text-fg-3"}`}>{t}</dt>
                    <dd className="m-0 text-body text-fg-2">{d}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </Band>
    </>
  );
}
