import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

test("a Sentry signing secret can be generated and a signed test delivery verifies", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/integrations?kind=sentry");
  await page.getByRole("button", { name: "Generate signing secret" }).click();
  await expect(page.getByText("will not be shown again")).toBeVisible();
  await page.getByRole("button", { name: "Send test delivery" }).click();
  await expect(page.getByText("the signature verified")).toBeVisible();
});
