/**
 * GitHub App manifest flow: GitHub creates the app from this description, then hands back its
 * credentials once. One app serves both repository access and "Sign in with GitHub".
 */
export function buildManifest(appUrl: string, name = "Aftershock") {
  const base = appUrl.replace(/\/+$/, "");
  return {
    name,
    url: base,
    hook_attributes: { url: `${base}/api/webhooks/github`, active: true },
    redirect_url: `${base}/setup/github/callback`,
    callback_urls: [`${base}/api/auth/callback`],
    setup_url: `${base}/onboarding`,
    setup_on_update: true,
    public: false,
    default_permissions: { contents: "write", issues: "read", metadata: "read", checks: "write", pull_requests: "write" },
    default_events: ["issues", "pull_request", "check_run"],
  };
}

export function manifestFormAction(org: string | undefined, state: string): string {
  if (org && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(org)) throw new Error("That is not a valid GitHub organisation name");
  const path = org ? `organizations/${org}/settings/apps/new` : "settings/apps/new";
  return `https://github.com/${path}?state=${encodeURIComponent(state)}`;
}

export type AppEnv = {
  GITHUB_APP_ID: string;
  GITHUB_APP_SLUG: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  AUTH_GITHUB_ID: string;
  AUTH_GITHUB_SECRET: string;
};

/** Exchanges the one-time code GitHub returns for the new app's credentials, as environment variables. */
export async function convertManifestCode(code: string, fetcher: typeof fetch = fetch): Promise<AppEnv> {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(code)) throw new Error("GitHub returned an invalid code");
  const res = await fetcher(`https://api.github.com/app-manifests/${code}/conversions`, { method: "POST", headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error("The setup code expired or was already used. Start again from /setup/github.");
  const d = (await res.json()) as { id: number; slug: string; client_id: string; client_secret: string; webhook_secret: string; pem: string };
  return {
    GITHUB_APP_ID: String(d.id),
    GITHUB_APP_SLUG: d.slug,
    GITHUB_APP_PRIVATE_KEY: d.pem.replace(/\n/g, "\\n"),
    GITHUB_WEBHOOK_SECRET: d.webhook_secret,
    AUTH_GITHUB_ID: d.client_id,
    AUTH_GITHUB_SECRET: d.client_secret,
  };
}
