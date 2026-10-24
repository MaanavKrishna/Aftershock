import type { NextRequest } from "next/server";
import { receive } from "@/lib/integrations/receive";

export async function POST(req: NextRequest) {
  return receive("pagerduty", req);
}
