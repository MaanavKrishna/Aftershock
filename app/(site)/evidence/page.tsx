import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Band, PageHero, SectionHead } from "@/components/site/Section";

export const metadata: Metadata = { title: "Audit evidence", description: "Signed, verifiable evidence that incidents became tested controls, for SOC 2 and DORA.", alternates: { canonical: "/evidence" } };

const CONTENTS: [string, string][] = [
  ["The incident", "What happened, what should have happened, its source and severity."],
  ["The fix", "The fix commit, the commit before it, and the pull request."],
  ["Every proof attempt", "Outcomes before and on the fix, the runner, and SHA-256 hashes of the test and its log."],
  ["The tests in memory", "Each proven test by hash, its nightly health, quarantine and the latest still-guarding re-proof."],
  ["Every pull request it guarded", "The commit tested, the verdict, and any override with the reason a person gave."],
];

const VERIFY = `import { readFileSync } from "node:fs";
import { createPublicKey, verify } from "node:crypto";
import canonicalize from "canonicalize"; // any RFC 8785 implementation

const bundle = JSON.parse(readFileSync("INC-12.json", "utf8"));
const { keys } = await (await fetch("https://aftershock-mk.vercel.app/.well-known/aftershock-jwks.json")).json();
const jwk = keys.find((k) => k.kid === bundle.signature.kid);
const ok = verify(null, Buffer.from(canonicalize(bundle.payload)),
  createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(bundle.signature.value, "base64url"));`;

export default function Evidence() {
  return (
    <>
      <PageHero eyebrow="Audit evidence" title="Proof that incidents became controls." lede="SOC 2 asks how incidents feed back into change management (CC7.4, CC8.1). The EU’s Digital Operational Resilience Act asks financial firms to learn from incidents (Article 13). Aftershock produces the evidence as a side effect of doing the work." />
      <Band tone="s1" labelledBy="bundle-h">
        <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHead id="bundle-h" title="One signed bundle per incident" lede="Download it from the incident page or the API. The payload is canonical JSON (RFC 8785), signed with Ed25519." />
            <dl className="m-0 flex flex-col">
              {CONTENTS.map(([t, d], i) => (
                <div key={t} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-t border-border-soft py-4">
                  <span className="pt-0.5 font-mono text-callout text-fg-3" aria-hidden="true">0{i + 1}</span>
                  <div className="flex flex-col gap-1">
                    <dt className="text-body font-semibold text-fg">{t}</dt>
                    <dd className="m-0 text-body text-fg-2">{d}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
          <div className="min-w-0 lg:sticky lg:top-28">
            <CodeBlock file="verify.mjs" code={VERIFY} />
          </div>
        </div>
      </Band>
      <Band labelledBy="keys-h">
        <SectionHead id="keys-h" title="Keys you can check" lede={<>Public keys are published at <code className="font-mono text-[0.9em] text-fg">/.well-known/aftershock-jwks.json</code>. Retired keys stay listed, so bundles from before a rotation still verify. Self-hosted installations sign with their own key.</>} />
        <div className="flex flex-wrap gap-3"><ButtonLink href="/signin" size="lg">Install on GitHub</ButtonLink><ButtonLink href="/docs/evidence" size="lg" variant="secondary">Evidence docs</ButtonLink></div>
      </Band>
    </>
  );
}
