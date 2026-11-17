import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { scoped } from "@/lib/db/queries/scope";
import { insightsFrom } from "@/lib/domain/insights";
import { InsightsView } from "@/components/app/InsightsView";
import { LogoMark } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Reliability report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public, read-only, aggregate numbers only. The secret link is the only way in; revoking it ends access. */
export default async function Report({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^rr_[A-Za-z0-9_-]{24}$/.test(token)) notFound();
  const db = await getDb();
  const [ws] = await db.select().from(s.workspaces).where(sql`${s.workspaces.settings}->>'reportToken' = ${token}`);
  const stored = ws?.settings.reportToken;
  if (!ws || !stored || stored.length !== token.length || !timingSafeEqual(Buffer.from(stored), Buffer.from(token))) notFound();
  const i = insightsFrom(await scoped(ws.id).insightsData());
  const generated = new Date().toISOString().slice(0, 16).replace("T", " ");
  return (
    <div className="min-h-screen bg-canvas text-ui text-fg">
      <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col gap-4 border-b border-border pb-6">
          <span className="flex items-center gap-2.5">
            <LogoMark size={24} accent />
            <span className="text-callout font-medium uppercase tracking-wide text-fg-3">Aftershock · Reliability report</span>
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-title-1 font-semibold text-fg">{ws.name}</h1>
            <p className="m-0 max-w-[70ch] text-ui text-fg-2">Every incident here became a test proven against git history: it failed before the fix and passed on it.</p>
            <p className="m-0 text-caption tabular-nums text-fg-3">Generated {generated} UTC · read-only · no incident titles, files or code</p>
          </div>
        </header>
        <InsightsView i={i} showFiles={false} />
      </main>
    </div>
  );
}
