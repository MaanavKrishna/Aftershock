import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOCS } from "@/lib/docs";
import { DocView } from "@/components/site/DocPage";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS.filter((d) => d.slug).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = DOCS.find((x) => x.slug === slug);
  return d ? { title: `${d.title} · Docs`, alternates: { canonical: `/docs/${slug}` } } : {};
}

export default async function DocSlug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = DOCS.find((d) => d.slug === slug);
  if (!page) notFound();
  return <DocView page={page} />;
}
