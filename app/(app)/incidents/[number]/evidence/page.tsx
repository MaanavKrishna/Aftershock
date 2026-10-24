import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentScope } from "@/lib/auth/scope";
import { TopBar, Main } from "@/components/app/TopBar";
import { Card, CardHead } from "@/components/ui/Card";
import { buildEvidence } from "@/lib/evidence/bundle";
import { evidenceKey } from "@/lib/evidence/sign";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  return { title: `Evidence · incident ${number}` };
}

const short = (sha: string | null | undefined) => (sha ? sha.slice(0, 7) : "—");
const when = (d: string | null) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—");

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-line-soft px-[22px] py-2.5 text-[13.5px] last:border-b-0">
      <span className="w-[170px] shrink-0 text-muted">{k}</span>
      <span className="min-w-0 flex-1 break-words">{v}</span>
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
      <TopBar title={`Evidence · ${e.incident.key}`} />
      <Main>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">Evidence for {e.incident.key}</h1>
            <p className="m-0 text-muted">{e.incident.title} · {e.repository ?? "no repository"} · issued {when(e.issuedAt)}</p>
          </div>
          <a href={`/api/v1/incidents/${number}/evidence`} className="inline-flex min-h-[44px] items-center rounded-[9px] bg-ink px-4 font-semibold text-white no-underline print:hidden">Download signed JSON</a>
        </div>
        <Card>
          <CardHead>Incident</CardHead>
          <Row k="Status" v={e.incident.status} />
          <Row k="Source" v={`${e.incident.source}${e.incident.sourceRef ? ` · ${e.incident.sourceRef}` : ""}`} />
          <Row k="Opened" v={when(e.incident.openedAt)} />
          {e.incident.observed && <Row k="Observed" v={e.incident.observed} />}
          {e.incident.expected && <Row k="Expected" v={e.incident.expected} />}
          <Row k="Fix" v={<span className="font-mono">{short(e.fix.sha)}{e.fix.pr ? ` · PR #${e.fix.pr}` : ""}{e.fix.title ? ` · ${e.fix.title}` : ""}</span>} />
        </Card>
        <Card>
          <CardHead>Proof</CardHead>
          {e.proof.length === 0 && <p className="m-0 px-[22px] py-4 text-muted">No proof attempts yet.</p>}
          {e.proof.map((p) => (
            <Row key={p.attempt} k={`Attempt ${p.attempt} · ${p.status}`} v={<span className="font-mono text-[12.5px]">before the fix {short(p.beforeTheFix.sha)}: {p.beforeTheFix.outcomes.join(" ") || "—"} · on the fix {short(p.onTheFix.sha)}: {p.onTheFix.outcomes.join(" ") || "—"} · test sha256 {p.testSha256?.slice(0, 12) ?? "—"} · {p.runner} · {when(p.finishedAt)}</span>} />
          ))}
        </Card>
        {e.memoryTests.map((m) => (
          <Card key={m.path}>
            <CardHead>Memory test</CardHead>
            <Row k="Path" v={<span className="font-mono">{m.path}</span>} />
            <Row k="Proven" v={when(m.provenAt)} />
            <Row k="Health on main" v={`${m.health}${m.quarantined ? " · quarantined" : ""}`} />
            <Row k="Still guarding" v={m.guardStatus ? `${m.guardStatus} at ${short(m.guardSha)} · ${when(m.guardCheckedAt)}` : "not re-proved"} />
          </Card>
        ))}
        <Card>
          <CardHead>Pull requests guarded</CardHead>
          {e.guard.length === 0 && <p className="m-0 px-[22px] py-4 text-muted">No pull request has run this test yet.</p>}
          {e.guard.map((g, i) => (
            <Row key={i} k={`${g.mergeQueue ? "Merge queue" : "PR"} #${g.prNumber}`} v={<span><span className="font-mono">{g.test}</span>: {g.verdict} on <span className="font-mono">{short(g.testedSha)}</span> · {when(g.at)}{g.overridden ? ` · overridden: ${g.overrideReason ?? "no reason"}` : ""}</span>} />
          ))}
        </Card>
        <p className="m-0 text-[12.5px] text-muted">The JSON download is signed with Ed25519 (key <span className="font-mono">{kid}</span>) over its RFC 8785 canonical form. Verify it against <span className="font-mono">/.well-known/aftershock-jwks.json</span>; see the evidence docs.</p>
      </Main>
    </>
  );
}
