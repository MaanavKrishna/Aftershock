import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "https://aftershock-mk.vercel.app").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/overview", "/incidents", "/memory", "/pulls", "/insights", "/repositories", "/integrations", "/settings", "/onboarding", "/report/", "/styleguide"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
