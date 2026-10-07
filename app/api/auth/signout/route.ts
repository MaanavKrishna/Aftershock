import { NextResponse, type NextRequest } from "next/server";
import { absolute } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/auth/token";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(absolute(req, "/"), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
