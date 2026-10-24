import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

test("admins add a signed webhook target once Notifications are on; private addresses are refused", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/settings?tab=notifications");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Settings · Notifications/);
  if (await page.getByText("Notifications are in Labs").isVisible()) {
    await page.goto("/settings?tab=labs");
    await page.getByRole("switch", { name: /Slack and outbound webhooks/ }).click();
    await expect(page.getByRole("switch", { name: /Slack and outbound webhooks/ })).toHaveAttribute("aria-checked", "true");
    await page.goto("/settings?tab=notifications");
  }
  await page.getByLabel("Type").selectOption("webhook");
  await page.getByLabel("Name").fill("e2e-ops");
  await page.getByLabel("URL").fill("https://127.0.0.1/hook");
  await page.getByRole("button", { name: "Add target" }).click();
  await expect(page.getByText("private or internal are not allowed")).toBeVisible();

  await page.getByLabel("URL").fill("https://ops.example.com/hooks/aftershock");
  await page.getByRole("button", { name: "Add target" }).click();
  await expect(page.getByText("It will not be shown again")).toBeVisible();
  await expect(page.getByText(/^whsec_/)).toBeVisible();
  await expect(page.getByText("ops.example.com/hooks/aftershock")).toBeVisible();

  await page.getByRole("button", { name: "Remove e2e-ops" }).click();
  await expect(page.getByText("ops.example.com/hooks/aftershock")).toHaveCount(0);
});

test("Slack targets must be Slack incoming webhook URLs", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/settings?tab=notifications");
  test.skip(await page.getByText("Notifications are in Labs").isVisible(), "flag is switched on by the previous test");
  await page.getByLabel("Type").selectOption("slack");
  await page.getByLabel("URL").fill("https://evil.example.com/services/T/B/x");
  await page.getByRole("button", { name: "Add target" }).click();
  await expect(page.getByText("Use a Slack incoming webhook URL")).toBeVisible();
});
