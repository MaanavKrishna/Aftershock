import type { NextRequest } from "next/server";
import { receive } from "@/lib/integrations/receive";

export async function POST(req: NextRequest, ctx: { params: Promise<{ source: string }> }) {
  return receive((await ctx.params).source, req);
}
