import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { scoped } from "@/lib/db/queries/scope";
import { insightsFrom } from "@/lib/domain/insights";
import { InsightsView } from "@/components/app/InsightsView";

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
  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-10">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[12px] tracking-[0.06em] text-muted">AFTERSHOCK · RELIABILITY REPORT</span>
        <h1 className="m-0 text-[30px] font-semibold tracking-[-0.025em]">{ws.name}</h1>
        <p className="m-0 text-muted">Every incident here became a test proven against git history: it failed before the fix and passed on it. Generated {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.</p>
      </header>
      <InsightsView i={i} showFiles={false} />
    </main>
  );
}
