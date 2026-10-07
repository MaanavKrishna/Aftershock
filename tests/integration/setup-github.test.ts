import { test, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as callback } from "@/app/setup/github/callback/route";
import { POST as start } from "@/app/setup/github/start/route";

afterEach(() => {
  delete process.env.GITHUB_APP_ID;
});

test("start sends the browser to GitHub with the manifest and a state cookie", async () => {
  const res = await start(new NextRequest("https://aftershock.example.com/setup/github/start", { method: "POST", body: new URLSearchParams({ org: "" }) }));
  const html = await res.text();
  expect(res.headers.get("set-cookie")).toMatch(/as_manifest_state=/);
  expect(html).toContain('action="https://github.com/settings/apps/new?state=');
  expect(html).toContain("aftershock.example.com/api/webhooks/github");
});

test("a callback with the wrong state is refused", async () => {
  const res = await callback(new NextRequest("https://x/setup/github/callback?code=abc&state=evil", { headers: { cookie: "as_manifest_state=good" } }));
  expect(res.status).toBe(400);
});

test("setup is locked once a GitHub App is configured", async () => {
  process.env.GITHUB_APP_ID = "1";
  expect((await start(new NextRequest("https://x/setup/github/start", { method: "POST", body: new URLSearchParams() }))).status).toBe(403);
  expect((await callback(new NextRequest("https://x/setup/github/callback?code=a&state=s", { headers: { cookie: "as_manifest_state=s" } }))).status).toBe(403);
});
