import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

test("the signed evidence download verifies against the published keys", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/incidents/12/evidence");
  await expect(page.getByRole("link", { name: "Download signed JSON" })).toBeVisible();
  const res = await page.request.get("/api/v1/incidents/12/evidence");
  expect(res.status()).toBe(200);
  const bundle = await res.json();
  expect(bundle.signature).toMatchObject({ alg: "EdDSA", canonicalization: "RFC8785" });
  const jwks = await (await page.request.get("/.well-known/aftershock-jwks.json")).json();
  expect(jwks.keys.map((k: { kid: string }) => k.kid)).toContain(bundle.signature.kid);
});
