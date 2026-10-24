import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

test("owners change a member's role, and the change is in the audit log", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/settings?tab=team");
  const row = page.getByRole("group", { name: /teammate-b/ });
  await row.getByRole("combobox", { name: "Role" }).selectOption("admin");
  await row.getByRole("button", { name: "Update role" }).click();
  await expect(page.getByRole("group", { name: /teammate-b/ }).getByRole("combobox", { name: "Role" })).toHaveValue("admin");
  await page.goto("/settings?tab=audit");
  await expect(page.getByText("member.role")).toBeVisible();
});

test("an incident is deleted only after typing its key", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/incidents/9");
  const key = (await page.getByTestId("incident-key").textContent())!.trim();
  await page.getByRole("button", { name: "Delete incident" }).click();
  await expect(page.getByText(/Type .* to confirm/)).toBeVisible();
  await page.getByLabel(/Type .* to confirm/).fill("WRONG");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "did not match" })).toBeVisible();
  await page.getByLabel(/Type .* to confirm/).fill(key);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await page.waitForURL("**/incidents");
  await page.goto("/incidents/9");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/doesn.t exist/i);
});
