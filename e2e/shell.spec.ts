import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInDemo } from "./helpers";

test("⌘K finds an incident by its title and opens it", async ({ page }) => {
  await signInDemo(page);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("ControlOrMeta+k");
  const box = page.getByRole("combobox", { name: /Search pages, actions and incidents/ });
  await expect(box).toBeFocused();
  await box.fill("charged a customer twice");
  await expect(page.getByRole("option", { name: /INC-12/ })).toBeVisible({ timeout: 20_000 });
  await box.press("Enter");
  await page.waitForURL("**/incidents/12");
});

test("the activity inbox lists recent activity and links to incidents", async ({ page }) => {
  await signInDemo(page);
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/^Activity/).click();
  const panel = page.locator("details[open]");
  await expect(panel.getByText("Activity", { exact: true })).toBeVisible();
  await expect(panel.locator("li").first()).toBeVisible();
});

test("on a phone the navigation opens as a drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInDemo(page);
  await page.waitForLoadState("networkidle");
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(async () => {
    await page.getByLabel("Open navigation").click();
    await expect(drawer).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await drawer.getByRole("link", { name: "Memory" }).click();
  await page.waitForURL("**/memory");
});

for (const scheme of ["light", "dark"] as const) {
  test.describe(`app in ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const path of ["/overview", "/incidents", "/incidents/12", "/memory", "/pulls/214", "/insights", "/settings?tab=notifications"]) {
      test(`${path} has no serious accessibility violations`, async ({ page }) => {
        await signInDemo(page);
        await page.goto(path);
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 4).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      });
    }
  });
}
