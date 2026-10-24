import type { Metadata } from "next";
import { DsLink } from "@/components/ds/Button";
import { CodeBlock } from "@/components/ds/CodeBlock";
import { Band, SectionHead } from "@/components/site/Section";

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
      <section className="mx-auto max-w-[1240px] px-4 pb-14 pt-16 sm:px-6 sm:pt-20">
        <h1 className="m-0 max-w-[20ch] text-balance font-display text-d1 font-semibold tracking-[-0.03em] text-fg">Proof that incidents became controls.</h1>
        <p className="mt-6 max-w-[62ch] text-lede text-fg-2">SOC 2 asks how incidents feed back into change management (CC7.4, CC8.1). The EU’s Digital Operational Resilience Act asks financial firms to learn from incidents (Article 13). Aftershock produces the evidence as a side effect of doing the work.</p>
      </section>
      <Band tone="raised">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHead title="One signed bundle per incident" lede="Download it from the incident page or the API. The payload is canonical JSON (RFC 8785), signed with Ed25519." />
            <dl className="m-0 flex flex-col">
              {CONTENTS.map(([t, d]) => <div key={t} className="flex flex-col gap-0.5 border-t border-rule py-3"><dt className="font-semibold text-fg">{t}</dt><dd className="m-0 text-[15px] text-fg-2">{d}</dd></div>)}
            </dl>
          </div>
          <CodeBlock file="verify.mjs" code={VERIFY} />
        </div>
      </Band>
      <Band>
        <SectionHead title="Keys you can check" lede={<>Public keys are published at <code className="font-code text-[0.9em]">/.well-known/aftershock-jwks.json</code>. Retired keys stay listed, so bundles from before a rotation still verify. Self-hosted installations sign with their own key.</>} />
        <div className="flex flex-wrap gap-3"><DsLink href="/signin">Install on GitHub</DsLink><DsLink href="/docs/evidence" variant="secondary">Evidence docs</DsLink></div>
      </Band>
    </>
  );
}
