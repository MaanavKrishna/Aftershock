import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SOURCES, SOURCE_IDS, isSource } from "@/lib/integrations/sources";
import { DsLink } from "@/components/ds/Button";
import { CodeBlock } from "@/components/ds/CodeBlock";

export const dynamicParams = false;
export function generateStaticParams() {
  return SOURCE_IDS.map((slug) => ({ slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return isSource(slug) ? { title: `${SOURCES[slug].label} integration`, description: SOURCES[slug].text, alternates: { canonical: `/connect/${slug}` } } : {};
}

export default async function Source({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSource(slug)) notFound();
  const s = SOURCES[slug];
  return (
    <section className="mx-auto max-w-[900px] px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="m-0 font-display text-d1 font-semibold tracking-[-0.03em] text-fg">{s.label}</h1>
      <p className="mt-5 max-w-[60ch] text-lede text-fg-2">{s.text}</p>
      <dl className="mt-10 flex flex-col">
        {[
          ["Availability", s.labs ? "In Labs: turn on “incident.io, Rootly, Opsgenie, Datadog, Linear, Jira and generic webhooks” in Settings → Labs." : "Available on every plan."],
          ["How deliveries are checked", s.auth === "signature" ? (s.secretFrom === "provider" ? `Signed by ${s.label}; paste its signing secret into Aftershock.` : "Signed with Standard Webhooks using a secret Aftershock generates.") : "A per-workspace token, sent as Authorization: Bearer <token>."],
          ["Repository mapping", s.mapping.label],
          ["Set up", s.setup],
        ].map(([k, v]) => (
          <div key={k} className="grid gap-1 border-t border-rule py-4 sm:grid-cols-[220px_1fr]"><dt className="font-semibold text-fg">{k}</dt><dd className="m-0 text-fg-2">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-8">
        <CodeBlock file="Webhook URL" code={`https://aftershock-mk.vercel.app/api/webhooks/${s.id}?workspace=<your-login>`} />
      </div>
      <div className="mt-8 flex flex-wrap gap-3"><DsLink href="/signin">Install on GitHub</DsLink><DsLink href="/docs/integrations" variant="secondary">All sources in the docs</DsLink></div>
    </section>
  );
}
