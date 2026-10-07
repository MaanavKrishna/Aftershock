import type { NextRequest } from "next/server";
import { buildManifest, manifestFormAction } from "@/lib/github/manifest";
import { absolute } from "@/lib/http/url";
import { esc, page } from "@/lib/http/html";

const STATE_COOKIE = "as_manifest_state";

/** Hands the browser to GitHub with the app manifest. Disabled once an app is configured. */
export async function POST(req: NextRequest) {
  if (process.env.GITHUB_APP_ID) return page("Already set up", "<h1>A GitHub App is already configured.</h1>", 403);
  const form = await req.formData();
  const org = String(form.get("org") ?? "").trim() || undefined;
  const appUrl = process.env.APP_URL ?? absolute(req, "/").origin;
  let action: string;
  const state = crypto.randomUUID();
  try {
    action = manifestFormAction(org, state);
  } catch (err) {
    return page("Setup", `<h1>Check the organisation name</h1><p>${esc((err as Error).message)}</p><p><a href="/setup/github">Back</a></p>`, 400);
  }
  const manifest = JSON.stringify(buildManifest(appUrl));
  const res = page(
    "Create the GitHub App",
    `<h1>Opening GitHub…</h1><form id="f" method="post" action="${esc(action)}"><input type="hidden" name="manifest" value="${esc(manifest)}"><button type="submit">Continue to GitHub</button></form><script>document.getElementById("f").submit()</script>`,
  );
  const secure = appUrl.startsWith("https://") ? "; Secure" : "";
  res.headers.append("set-cookie", `${STATE_COOKIE}=${state}; Path=/setup/github; HttpOnly; SameSite=Lax; Max-Age=900${secure}`);
  return res;
}
