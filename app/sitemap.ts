import type { MetadataRoute } from "next";
import { DOCS, docHref } from "@/lib/docs";
import { SOURCE_IDS } from "@/lib/integrations/sources";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL ?? "https://aftershock-mk.vercel.app").replace(/\/$/, "");
  const pages = ["/", "/product", "/agents", "/evidence", "/connect", "/pricing", "/security", "/compare", "/changelog", "/privacy", "/terms", "/signin"];
  return [...pages, ...DOCS.map((d) => docHref(d.slug)), ...SOURCE_IDS.map((id) => `/connect/${id}`)].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "/" ? 1 : 0.6 }));
}
