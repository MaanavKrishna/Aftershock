import type { Metadata } from "next";
import { DOCS } from "@/lib/docs";
import { DocView } from "@/components/site/DocPage";

export const metadata: Metadata = { title: "Docs", description: "Install Aftershock and prove your first incident in about ten minutes.", alternates: { canonical: "/docs" } };

export default function Docs() {
  return <DocView page={DOCS[0]} />;
}
