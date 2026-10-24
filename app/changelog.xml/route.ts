import { releases } from "@/lib/docs/changelog";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  const base = (process.env.APP_URL ?? "https://aftershock-mk.vercel.app").replace(/\/$/, "");
  const items = (await releases())
    .map((r) => `<item><title>Aftershock v${esc(r.version)}</title><link>${base}/changelog#v${esc(r.version)}</link><guid>${base}/changelog#v${esc(r.version)}</guid><pubDate>${new Date(`${r.date}T00:00:00Z`).toUTCString()}</pubDate><description>${esc(r.text)}</description></item>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Aftershock changelog</title><link>${base}/changelog</link><description>Every Aftershock release.</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
