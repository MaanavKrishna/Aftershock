import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SOURCES, SOURCE_IDS, isSource } from "@/lib/integrations/sources";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/site/Section";
import { CodeBlock } from "@/components/ui/CodeBlock";

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
  const rows: [string, string][] = [
    ["Availability", s.labs ? "In Labs: turn on “incident.io, Rootly, Opsgenie, Datadog, Linear, Jira and generic webhooks” in Settings → Labs." : "Available on every plan."],
    ["How deliveries are checked", s.auth === "signature" ? (s.secretFrom === "provider" ? `Signed by ${s.label}; paste its signing secret into Aftershock.` : "Signed with Standard Webhooks using a secret Aftershock generates.") : "A per-workspace token, sent as Authorization: Bearer <token>."],
    ["Repository mapping", s.mapping.label],
    ["Set up", s.setup],
  ];
  return (
    <Container width="narrow" className="py-16 sm:py-24">
      <nav aria-label="Breadcrumb" className="mb-6 text-callout text-fg-3">
        <Link href="/connect" className="text-fg-2 no-underline hover:text-fg">Integrations</Link>
        <span aria-hidden="true" className="px-2">/</span>
        <span aria-current="page">{s.label}</span>
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-display-2 font-semibold text-fg">{s.label}</h1>
        {s.labs && <span className="inline-flex min-h-6 items-center rounded-full bg-s2 px-2.5 text-callout font-medium text-fg-2">Labs</span>}
      </div>
      <p className="m-0 mt-5 max-w-[60ch] text-lede text-fg-2">{s.text}</p>
      <dl className="m-0 mt-10 overflow-hidden rounded-card border border-border bg-s1 shadow-e1">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 border-t border-border-soft px-5 py-4 first:border-t-0 sm:grid-cols-[200px_1fr] sm:gap-6">
            <dt className="text-callout font-medium text-fg-3">{k}</dt>
            <dd className="m-0 text-body text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8">
        <CodeBlock file="Webhook URL" code={`https://aftershock-mk.vercel.app/api/webhooks/${s.id}?workspace=<your-login>`} />
      </div>
      <div className="mt-10 flex flex-wrap gap-3"><ButtonLink href="/signin" size="lg">Install on GitHub</ButtonLink><ButtonLink href="/docs/integrations" size="lg" variant="secondary">All sources in the docs</ButtonLink></div>
    </Container>
  );
}
