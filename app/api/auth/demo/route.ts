import { NextResponse, type NextRequest } from "next/server";
import { absolute } from "@/lib/http/url";
import { seedDemo } from "@/lib/db/seed";
import { sessionCookie } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  if (process.env.AFTERSHOCK_DEMO !== "1") return NextResponse.json({ error: "Demo mode is off" }, { status: 404 });
  const session = await seedDemo();
  const res = NextResponse.redirect(absolute(req, "/overview"), 303);
  res.cookies.set(await sessionCookie(session));
  return res;
}
