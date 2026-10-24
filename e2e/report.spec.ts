import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

test("a shared reliability report opens without signing in and closes when sharing stops", async ({ page, browser }) => {
  await signInDemo(page);
  await page.goto("/insights");
  if (await page.getByRole("button", { name: "Stop sharing" }).isVisible()) await page.getByRole("button", { name: "Stop sharing" }).click();
  await page.getByRole("button", { name: "Create share link" }).click();
  const url = (await page.locator("code", { hasText: "/report/rr_" }).textContent())!.trim();
  const path = new URL(url, page.url()).pathname;
  const anon = await browser.newContext();
  const p2 = await anon.newPage();
  await p2.goto(path);
  await expect(p2.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(p2.getByText("RELIABILITY REPORT")).toBeVisible();
  await expect(p2.getByText("Fault lines")).toHaveCount(0);
  await page.getByRole("button", { name: "Stop sharing" }).click();
  await expect(page.getByRole("button", { name: "Create share link" })).toBeVisible();
  expect((await p2.goto(path))?.status()).toBe(404);
  await anon.close();
});
