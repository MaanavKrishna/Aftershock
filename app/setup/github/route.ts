import type { NextRequest } from "next/server";
import { page } from "@/lib/http/html";
import { absolute } from "@/lib/http/url";

/** One-time setup: creates Aftershock's GitHub App from a manifest. */
export async function GET(req: NextRequest) {
  if (process.env.GITHUB_APP_ID) {
    return page("GitHub App", `<h1>GitHub is connected.</h1><p>The GitHub App is configured. Manage it from <a href="/integrations?kind=github">Integrations</a>.</p>`);
  }
  const appUrl = process.env.APP_URL ?? absolute(req, "/").origin;
  return page(
    "Set up GitHub",
    `<h1>Create Aftershock’s GitHub App</h1>
<p>GitHub will open with every setting filled in for <code>${appUrl.replace(/[<>&"]/g, "")}</code>: webhook, permissions, events and sign-in. You review and confirm; nothing is created without your click.</p>
<form method="post" action="/setup/github/start">
<label>Organisation (optional)<input name="org" placeholder="Leave empty to create it on your personal account"></label>
<button type="submit">Create GitHub App</button>
</form>
<p style="font-size:13px">Permissions requested: contents read &amp; write (used only for <code>aftershock/*</code> branches), issues read, checks and pull requests read &amp; write.</p>`,
  );
}
