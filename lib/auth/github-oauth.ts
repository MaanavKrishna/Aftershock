export const STATE_COOKIE = "as_oauth_state";

export function authorizeUrl(state: string, origin: string): string {
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", process.env.AUTH_GITHUB_ID ?? "");
  u.searchParams.set("redirect_uri", `${origin}/api/auth/callback`);
  u.searchParams.set("scope", "read:user read:org");
  u.searchParams.set("state", state);
  return u.toString();
}

export type GithubUser = { id: number; login: string; name: string | null; avatar_url: string };

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.AUTH_GITHUB_ID, client_secret: process.env.AUTH_GITHUB_SECRET, code }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(data.error_description ?? "GitHub did not return an access token");
  return data.access_token;
}

export async function fetchUser(token: string): Promise<GithubUser> {
  const res = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub user lookup failed (${res.status})`);
  return (await res.json()) as GithubUser;
}
