import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

test("admins turn a Labs feature on, and saving workspace settings keeps it on", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/settings?tab=labs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Settings · Labs/);
  const cache = page.getByRole("switch", { name: /Reuse installed dependencies/ });
  await expect(cache).toHaveAttribute("aria-checked", "false");
  await cache.click();
  await expect(page.getByRole("switch", { name: /Reuse installed dependencies/ })).toHaveAttribute("aria-checked", "true");

  await page.goto("/settings?tab=workspace");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/settings?tab=labs");
  await expect(page.getByRole("switch", { name: /Reuse installed dependencies/ })).toHaveAttribute("aria-checked", "true");
});

test("with re-proofs on, the memory page offers Re-prove now", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/memory");
  await expect(page.getByRole("button", { name: "Re-prove now" })).toHaveCount(0);
  await page.goto("/settings?tab=labs");
  const sw = page.getByRole("switch", { name: /Weekly still-guarding re-proof/ });
  if ((await sw.getAttribute("aria-checked")) !== "true") await sw.click();
  await expect(page.getByRole("switch", { name: /Weekly still-guarding re-proof/ })).toHaveAttribute("aria-checked", "true");
  await page.goto("/memory");
  await expect(page.getByRole("button", { name: "Re-prove now" })).toBeVisible();
  await expect(page.getByText("Not re-proved yet")).toBeVisible();
});
