import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { limited } from "@/lib/http/rateLimit";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { flagEnabled } from "@/lib/flags";
import { badgeSvg } from "@/lib/badge";

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const notFound = () => new NextResponse("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });

/**
 * README badge: "incidents remembered | N · guarding". Served only for repositories GitHub reports as
 * public, in workspaces that turned the badge on; everything else is the same 404, so the badge can't
 * be used to learn whether a private repository exists.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  const tooMany = limited(req, "api");
  if (tooMany) return tooMany;
  const { owner, repo: raw } = await params;
  const repo = raw.replace(/\.svg$/, "");
  if (!NAME.test(owner) || !NAME.test(repo)) return notFound();
  const db = await getDb();
  const rows = await db
    .select({ r: s.repositories, w: s.workspaces })
    .from(s.repositories)
    .innerJoin(s.workspaces, eq(s.workspaces.id, s.repositories.workspaceId))
    .where(and(eq(s.repositories.fullName, `${owner}/${repo}`), eq(s.repositories.isPrivate, false), isNull(s.repositories.archivedAt)));
  const hit = rows.find((x) => flagEnabled("badge", x.w.settings));
  if (!hit) return notFound();
  const tests = await db.select({ health: s.memoryTests.health }).from(s.memoryTests).where(eq(s.memoryTests.repoId, hit.r.id));
  const failing = tests.filter((t) => t.health === "failing").length;
  const message = tests.length === 0 ? "none yet" : failing ? `${tests.length} · ${failing} failing` : `${tests.length} · guarding`;
  return new NextResponse(badgeSvg("incidents remembered", message, tests.length === 0 ? "none" : failing ? "fail" : "pass"), {
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=600", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" },
  });
}
