import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { Verdict, type VerdictKind } from "@/components/ui/Verdict";
import { buttonClass } from "@/components/ui/Button";
import { Shield } from "@/components/ui/icons";
import { buildEvidence } from "@/lib/evidence/bundle";
import { evidenceKey } from "@/lib/evidence/sign";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  return { title: `Evidence · incident ${number}` };
}

const short = (sha: string | null | undefined) => (sha ? sha.slice(0, 7) : "—");
const when = (d: string | null) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—");
const KINDS: Record<string, VerdictKind> = { proven: "proven", rejected: "rejected", unproven: "unproven", running: "running", recur: "recur", safe: "safe", inconclusive: "inconclusive", skipped: "skipped", healthy: "healthy", flaky: "flaky", failing: "failing", guarding: "healthy", weak: "weak", drifted: "drifted", awaiting_fix: "awaiting", traveling: "running" };
const V = ({ v }: { v: string }) => (KINDS[v] ? <Verdict kind={KINDS[v]} size="sm" /> : <span>{v}</span>);

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border-soft px-5 py-2.5 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-callout text-fg-3 sm:w-44">{k}</dt>
      <dd className="m-0 min-w-0 flex-1 break-words text-callout text-fg">{v}</dd>
    </div>
  );
}

/** Printable summary of the signed evidence bundle; the JSON download is the authoritative, verifiable copy. */
export default async function Evidence({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  if (!/^\d{1,9}$/.test(number)) notFound();
  const { session } = await currentScope();
  const e = await buildEvidence(session.workspaceId, Number(number));
  if (!e) notFound();
  const kid = evidenceKey().kid;
  return (
    <>
      <TopBar crumbs={[{ label: "Incidents", href: "/incidents" }, { label: e.incident.key, href: `/incidents/${number}` }, { label: "Evidence" }]} />
      <Main>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="m-0 text-title-1 font-semibold text-fg">Evidence for {e.incident.key}</h1>
            <p className="m-0 text-ui text-fg-2">
              {e.incident.title} · {e.repository ?? "no repository"} · issued {when(e.issuedAt)}
            </p>
          </div>
          <a href={`/api/v1/incidents/${number}/evidence`} className={buttonClass("primary", "sm", "print:hidden")}>
            <Shield size={15} />
            Download signed JSON
          </a>
        </header>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <CardHead>Incident</CardHead>
            <dl className="m-0">
              <Row k="Status" v={<V v={e.incident.status} />} />
              <Row k="Source" v={`${e.incident.source}${e.incident.sourceRef ? ` · ${e.incident.sourceRef}` : ""}`} />
              <Row k="Opened" v={<span className="font-mono">{when(e.incident.openedAt)}</span>} />
              {e.incident.observed && <Row k="Observed" v={e.incident.observed} />}
              {e.incident.expected && <Row k="Expected" v={e.incident.expected} />}
              <Row
                k="Fix"
                v={
                  <span>
                    <span className="font-mono">{short(e.fix.sha)}</span>
                    {e.fix.pr ? ` · PR #${e.fix.pr}` : ""}
                    {e.fix.title ? ` · ${e.fix.title}` : ""}
                  </span>
                }
              />
            </dl>
          </Card>
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <CardHead>Proof</CardHead>
              {e.proof.length === 0 && <p className="m-0 px-5 py-4 text-callout text-fg-3">No proof attempts yet.</p>}
              <dl className="m-0">
                {e.proof.map((p) => (
                  <Row
                    key={p.attempt}
                    k={`Attempt ${p.attempt}`}
                    v={
                      <span className="flex flex-col gap-1.5">
                        <V v={p.status} />
                        <span className="font-mono text-caption text-fg-2">
                          before {short(p.beforeTheFix.sha)}: {p.beforeTheFix.outcomes.join(" ") || "—"}
                          <br />
                          on the fix {short(p.onTheFix.sha)}: {p.onTheFix.outcomes.join(" ") || "—"}
                          <br />
                          test sha256 {p.testSha256?.slice(0, 12) ?? "—"} · {p.runner} · {when(p.finishedAt)}
                        </span>
                      </span>
                    }
                  />
                ))}
              </dl>
            </Card>
            {e.memoryTests.map((m) => (
              <Card key={m.path}>
                <CardHead>Memory test</CardHead>
                <dl className="m-0">
                  <Row k="Path" v={<span className="font-mono">{m.path}</span>} />
                  <Row k="Proven" v={<span className="font-mono">{when(m.provenAt)}</span>} />
                  <Row
                    k="Health on main"
                    v={
                      <span className="flex flex-wrap gap-1.5">
                        <V v={m.health} />
                        {m.quarantined && <Verdict kind="skipped" label="Quarantined" size="sm" />}
                      </span>
                    }
                  />
                  <Row k="Still guarding" v={m.guardStatus ? `${m.guardStatus} at ${short(m.guardSha)} · ${when(m.guardCheckedAt)}` : "Not re-proved"} />
                </dl>
              </Card>
            ))}
          </div>
        </div>
        <Card>
          <CardHead aside={<span className="text-caption tabular-nums text-fg-3">{e.guard.length}</span>}>Pull requests guarded</CardHead>
          {e.guard.length === 0 && <p className="m-0 px-5 py-4 text-callout text-fg-3">No pull request has run this test yet.</p>}
          <dl className="m-0">
            {e.guard.map((g, i) => (
              <Row
                key={i}
                k={`${g.mergeQueue ? "Merge queue" : "PR"} #${g.prNumber}`}
                v={
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <V v={g.verdict} />
                    <span className="font-mono text-caption text-fg-2">{g.test}</span>
                    <span className="text-caption text-fg-3">
                      on <span className="font-mono">{short(g.testedSha)}</span> · {when(g.at)}
                      {g.overridden ? ` · overridden: ${g.overrideReason ?? "no reason"}` : ""}
                    </span>
                  </span>
                }
              />
            ))}
          </dl>
        </Card>
        <p className="m-0 max-w-3xl text-caption text-fg-3">
          The JSON download is signed with Ed25519 (key <span className="font-mono">{kid}</span>) over its RFC 8785 canonical form. Verify it against <span className="font-mono">/.well-known/aftershock-jwks.json</span>; see the evidence docs.
        </p>
      </Main>
    </>
  );
}
