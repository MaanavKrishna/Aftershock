import { NextResponse, type NextRequest } from "next/server";
import { seedDemo } from "@/lib/db/seed";
import { sessionCookie } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  if (process.env.AFTERSHOCK_DEMO !== "1") return NextResponse.json({ error: "Demo mode is off" }, { status: 404 });
  const session = await seedDemo();
  const res = NextResponse.redirect(new URL("/overview", req.url), 303);
  res.cookies.set(await sessionCookie(session));
  return res;
}
