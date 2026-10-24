import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

test("importing all closed incident issues brings each in once", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/incidents/new?tab=issue");
  const all = page.getByRole("button", { name: "Import all and time travel" });
  test.skip((await all.count()) === 0, "a reused dev server already imported the demo issues");
  await all.click();
  await expect(page).toHaveURL(/\/incidents\?backfill=started/);
  await expect(async () => {
    await page.goto("/incidents/new?tab=issue");
    await expect(page.getByText("No closed issues are waiting")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
});
