import type { Metadata } from "next";
import Link from "next/link";
import { Band, PageHero, SectionHead } from "@/components/site/Section";

export const metadata: Metadata = { title: "Security", description: "How Aftershock isolates runs, what it keeps and for how long, and who processes your data.", alternates: { canonical: "/security" } };

const LIFE: [string, string][] = [
  ["Fresh machine", "A new Firecracker microVM boots from a clean image, or one restored from your own repository’s trusted install snapshot. Nothing from another team or run."],
  ["Shallow clone", "One commit is fetched with a one-hour installation token scoped read-only to that repository. The token is scrubbed from the checkout before your code runs."],
  ["Locked network", "Package registries are reachable while dependencies install. Then the network is set to deny-all, before any test runs."],
  ["Run and record", "The test runs under a time limit. We keep outcomes, the JUnit report and trimmed logs."],
  ["Destroyed", "The machine is stopped and deleted, with the clone and anything the test wrote."],
];
const RULES: [string, string][] = [
  ["The model never decides", "A drafted test is admitted only when it fails before the fix and passes after, on real commits. A model cannot mark anything proven or safe."],
  ["Least privilege on GitHub", "Clone tokens are read-only and per repository. The app writes only to aftershock/* branches, check runs and one comment; tests arrive as pull requests you merge."],
  ["No secrets in runs", "Your environment variables, deploy keys and cloud credentials are never available to sandboxed code. Tests that need them belong on your own runners."],
  ["Untrusted text stays data", "Incidents, postmortems, alerts and code reach the model inside random-nonce fences, and its output is parsed and validated before anything uses it."],
  ["Every delivery is authenticated", "Webhooks are verified by signature or token in constant time, size-capped and replay-checked before anything is stored or run."],
  ["Sessions you control", "Each sign-in is a server-side session that expires after 14 days idle or 30 days in total. You can see and end any of them in Settings, and removing someone from a workspace takes effect on their next request."],
  ["Hardened pages", "Signed-in pages run under a per-request Content Security Policy, so injected scripts can’t execute."],
  ["Outbound calls can’t reach inside", "Notification and model endpoints must be public https addresses; private, loopback and metadata addresses are refused when connecting."],
];
const DATA: [string, string, string][] = [
  ["Source code", "Never stored", "Exists only inside the sandbox for the run"],
  ["Incidents and notes", "Until you delete them", "They are what your tests are built from"],
  ["Proven test code", "In your repository", "It is yours; we keep a copy to run and display"],
  ["Run logs and webhook deliveries", "30 days", "For debugging; cleared automatically"],
  ["Verdicts and evidence", "Until you delete the repository or workspace", "The record of what was proven, and when"],
  ["Model keys, webhook secrets, Slack URLs", "Encrypted (AES-256-GCM) until removed", "To call the services you connected"],
  ["Workspaces that uninstall the app", "30 days, then purged", "So a reinstall can continue where it left off"],
];
const PROCESSORS: [string, string][] = [
  ["Vercel", "Hosting, the run sandboxes, durable workflows"],
  ["Neon", "Postgres database"],
  ["GitHub", "Sign-in, repositories, checks and pull requests"],
  ["The model provider you choose", "Drafting tests and triage; Vercel AI Gateway or any OpenAI-compatible endpoint"],
];

export default function Security() {
  return (
    <>
      <PageHero eyebrow="Security" title="We run your code. So we assume it’s hostile." lede={<p className="m-0">Running a team’s tests means executing their code, and code a model drafted. Every run is isolated, short-lived and secret-free by design. The full threat model is <a className="text-signal" href="https://github.com/MaanavKrishna/Aftershock/blob/main/docs/threat-model.md" rel="noopener">public</a>.</p>} />
      <Band tone="s1" labelledBy="life-h">
        <SectionHead id="life-h" title="The life of one sandbox run" lede="Every proof, re-proof and sandboxed pull request check follows the same path. Nothing survives the last step." />
        <ol className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-5">
          {LIFE.map(([t, d], i) => (
            <li key={t} className="relative flex flex-col gap-2 rounded-card border border-border bg-canvas p-5">
              <span className="flex items-center gap-2 font-mono text-caption text-fg-3">
                <span className={`h-1.5 w-1.5 rounded-full ${i === LIFE.length - 1 ? "bg-fg-3" : "bg-fg-2"}`} aria-hidden="true" />
                Step {i + 1}
              </span>
              <h3 className="m-0 text-title-3 font-semibold text-fg">{t}</h3>
              <p className="m-0 text-callout text-fg-2">{d}</p>
            </li>
          ))}
        </ol>
      </Band>
      <Band labelledBy="rules-h">
        <h2 id="rules-h" className="sr-only">Rules every run follows</h2>
        <div className="grid gap-x-14 gap-y-10 md:grid-cols-2">
          {RULES.map(([t, d]) => (
            <div key={t} className="flex flex-col gap-2 border-t border-border-soft pt-6">
              <h3 className="m-0 text-title-2 font-semibold text-fg">{t}</h3>
              <p className="m-0 text-body text-fg-2">{d}</p>
            </div>
          ))}
        </div>
      </Band>
      <Band tone="s1" labelledBy="keep-h">
        <SectionHead id="keep-h" title="What we keep, and for how long" />
        <div className="overflow-x-auto rounded-card border border-border bg-canvas">
          <table className="w-full min-w-[680px] border-collapse text-left text-ui">
            <thead>
              <tr className="border-b border-border bg-s2 text-callout text-fg-2">
                <th scope="col" className="px-5 py-3 font-medium">Data</th>
                <th scope="col" className="px-5 py-3 font-medium">Kept</th>
                <th scope="col" className="px-5 py-3 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {DATA.map(([k, v, w]) => (
                <tr key={k} className="border-t border-border-soft first:border-t-0">
                  <th scope="row" className="px-5 py-3.5 font-medium text-fg">{k}</th>
                  <td className="px-5 py-3.5 text-fg">{v}</td>
                  <td className="px-5 py-3.5 text-fg-2">{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-4 max-w-[80ch] text-callout text-fg-3">Admins can delete an incident, a repository or the workspace, and anyone can delete their own account, from the app. Deletions are recorded in the workspace audit log.</p>
      </Band>
      <Band labelledBy="proc-h">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <SectionHead id="proc-h" title="Who processes your data" />
            <ul className="m-0 flex list-none flex-col p-0">
              {PROCESSORS.map(([n, w]) => (
                <li key={n} className="flex flex-col gap-0.5 border-t border-border-soft py-4">
                  <span className="text-body font-semibold text-fg">{n}</span>
                  <span className="text-callout text-fg-2">{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHead title="Report a vulnerability" lede={<>Use GitHub’s private vulnerability reporting on the repository; you get a reply within 3 working days. Details are in <a className="text-signal" href="https://github.com/MaanavKrishna/Aftershock/blob/main/SECURITY.md" rel="noopener">SECURITY.md</a>.</>} />
            <p className="m-0 text-body text-fg-2">Audit evidence is signed and verifiable. See <Link href="/evidence" className="text-signal">audit evidence</Link>.</p>
          </div>
        </div>
      </Band>
    </>
  );
}
