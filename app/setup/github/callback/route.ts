import type { NextRequest } from "next/server";
import { convertManifestCode } from "@/lib/github/manifest";
import { esc, page } from "@/lib/http/html";

const STATE_COOKIE = "as_manifest_state";

/** GitHub returns here once with a one-time code; the new app's credentials are shown once to copy into Vercel. */
export async function GET(req: NextRequest) {
  if (process.env.GITHUB_APP_ID) return page("Already set up", "<h1>A GitHub App is already configured.</h1>", 403);
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const state = req.nextUrl.searchParams.get("state");
  if (!state || state !== req.cookies.get(STATE_COOKIE)?.value) {
    return page("Setup", `<h1>This setup link is not yours or has expired.</h1><p><a href="/setup/github">Start again</a></p>`, 400);
  }
  try {
    const env = await convertManifestCode(code);
    const rows = Object.entries(env).map(([k, v]) => `<div class="k">${k}</div><pre>${esc(v)}</pre>`).join("");
    const res = page(
      "GitHub App created",
      `<h1>Your GitHub App is ready.</h1>
<p class="warn"><strong>Copy these now.</strong> They are shown once and give control of the app. Add each one in Vercel → Project → Settings → Environment Variables (Production), then redeploy.</p>
${rows}
<p>After redeploying, install the app on your repositories from <a href="https://github.com/apps/${esc(env.GITHUB_APP_SLUG)}/installations/new">github.com/apps/${esc(env.GITHUB_APP_SLUG)}</a>, then sign in.</p>`,
    );
    res.headers.append("set-cookie", `${STATE_COOKIE}=; Path=/setup/github; Max-Age=0`);
    return res;
  } catch (err) {
    return page("Setup", `<h1>GitHub did not create the app.</h1><p>${esc((err as Error).message)}</p><p><a href="/setup/github">Start again</a></p>`, 502);
  }
}
