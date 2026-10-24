import { NextResponse } from "next/server";
import { jwks } from "@/lib/evidence/sign";

/** Public keys for verifying evidence bundles: the current key and any retired ones. */
export async function GET() {
  return NextResponse.json(jwks(), { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } });
}
