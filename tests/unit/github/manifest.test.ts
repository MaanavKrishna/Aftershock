import { test, expect } from "vitest";
import { buildManifest, convertManifestCode, manifestFormAction } from "@/lib/github/manifest";

test("the manifest points every URL at the deployment and asks for exactly the permissions Aftershock needs", () => {
  const m = buildManifest("https://aftershock.example.com/");
  expect(m.url).toBe("https://aftershock.example.com");
  expect(m.hook_attributes).toEqual({ url: "https://aftershock.example.com/api/webhooks/github", active: true });
  expect(m.redirect_url).toBe("https://aftershock.example.com/setup/github/callback");
  expect(m.callback_urls).toEqual(["https://aftershock.example.com/api/auth/callback"]);
  expect(m.setup_url).toBe("https://aftershock.example.com/onboarding");
  expect(m.default_permissions).toEqual({ contents: "write", issues: "read", metadata: "read", checks: "write", pull_requests: "write" });
  expect(m.default_events).toEqual(["issues", "pull_request", "check_run"]);
});

test("the form posts to the user's or an organisation's app settings, with state", () => {
  expect(manifestFormAction(undefined, "s1")).toBe("https://github.com/settings/apps/new?state=s1");
  expect(manifestFormAction("acme", "s1")).toBe("https://github.com/organizations/acme/settings/apps/new?state=s1");
  expect(() => manifestFormAction("../evil", "s1")).toThrow(/organisation/);
});

test("converting the code returns the values Vercel needs", async () => {
  const fetcher = async (url: string, init: RequestInit) => {
    expect(url).toBe("https://api.github.com/app-manifests/abc123/conversions");
    expect(init.method).toBe("POST");
    return new Response(JSON.stringify({ id: 42, slug: "aftershock-dev", client_id: "Iv1.x", client_secret: "cs", webhook_secret: "ws", pem: "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----\n", html_url: "https://github.com/apps/aftershock-dev" }), { status: 201 });
  };
  const env = await convertManifestCode("abc123", fetcher as typeof fetch);
  expect(env).toEqual({
    GITHUB_APP_ID: "42",
    GITHUB_APP_SLUG: "aftershock-dev",
    GITHUB_APP_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\\nabc\\n-----END RSA PRIVATE KEY-----\\n",
    GITHUB_WEBHOOK_SECRET: "ws",
    AUTH_GITHUB_ID: "Iv1.x",
    AUTH_GITHUB_SECRET: "cs",
  });
});

test("a bad code is a readable error", async () => {
  const fetcher = async () => new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
  await expect(convertManifestCode("nope", fetcher as typeof fetch)).rejects.toThrow(/expired or was already used/);
  await expect(convertManifestCode("bad code!", fetcher as typeof fetch)).rejects.toThrow(/code/);
});
