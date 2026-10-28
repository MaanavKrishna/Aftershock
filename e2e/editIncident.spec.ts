import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

test("an incident's details can be corrected, and the change is kept", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/incidents/12");
  await page.waitForLoadState("networkidle");
  await page.getByText("Edit details").click();
  await page.getByRole("textbox", { name: "Expected", exact: true }).fill("One order, one charge. A retry gets the documented 400.");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Details saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("main").getByText("One order, one charge. A retry gets the documented 400.").first()).toBeVisible();
});
