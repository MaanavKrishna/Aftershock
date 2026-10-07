import type { Page } from "@playwright/test";

export async function signInDemo(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Try the demo workspace" }).click();
  await page.waitForURL("**/overview");
}
