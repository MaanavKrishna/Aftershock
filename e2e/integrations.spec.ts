import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

test("a Sentry client secret can be pasted and a signed test delivery verifies", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/integrations?kind=sentry");
  await expect(page.getByRole("button", { name: "Generate signing secret" })).toHaveCount(0);
  await page.getByLabel("Signing secret from Sentry").fill("e2e-sentry-client-secret-0123456789");
  await page.getByRole("button", { name: "Save signing secret" }).click();
  await expect(page.getByText("Signing secret saved.")).toBeVisible();
  await page.getByRole("button", { name: "Send test delivery" }).click();
  await expect(page.getByText("the signature verified")).toBeVisible();
});

test("Labs sources appear once the flag is on, and a generic webhook secret verifies", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/integrations");
  await expect(page.getByRole("link", { name: /Generic webhook/ })).toHaveCount(0);
  await page.goto("/settings?tab=labs");
  const sw = page.getByRole("switch", { name: /incident\.io, Rootly/ });
  if ((await sw.getAttribute("aria-checked")) !== "true") await sw.click();
  await expect(page.getByRole("switch", { name: /incident\.io, Rootly/ })).toHaveAttribute("aria-checked", "true");

  await page.goto("/integrations?kind=webhook");
  await expect(page.getByRole("heading", { level: 2, name: "Generic webhook" })).toBeVisible();
  await page.getByRole("button", { name: "Generate signing secret" }).click();
  await expect(page.getByText("will not be shown again")).toBeVisible();
  await expect(page.getByText(/^whsec_/)).toBeVisible();
  await page.getByRole("button", { name: "Send test delivery" }).click();
  await expect(page.getByText("the signature verified")).toBeVisible();

  await page.goto("/integrations?kind=datadog");
  await page.getByRole("button", { name: "Generate token" }).click();
  await page.getByRole("button", { name: "Send test delivery" }).click();
  await expect(page.getByText("the token verified")).toBeVisible();
});
