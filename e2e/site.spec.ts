import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/product", "/agents", "/evidence", "/connect", "/connect/incidentio", "/pricing", "/security", "/compare", "/changelog", "/docs", "/docs/api", "/privacy", "/terms", "/signin", "/styleguide"];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const path of PAGES) {
      test(`${path} has one h1 and no serious accessibility violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("h1")).toHaveCount(1);
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      });
    }
  });
}

test("public pages fit a 390px phone without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("with reduced motion the proof replay shows its finished state at once", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByText("Recur: INC-12 would ship again")).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible();
  await ctx.close();
});

test("the theme toggle switches to dark and the choice survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/pricing");
  await page.getByRole("button", { name: /Theme: system/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("the mobile menu opens and lists the main pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Menu").click();
  await expect(page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Pricing" })).toBeVisible();
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(res.headers()["strict-transport-security"]).toContain("max-age=");
});

test("sitemap, robots, changelog feed and social image respond", async ({ request }) => {
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
  expect(await (await request.get("/changelog.xml")).text()).toContain("<rss");
  expect((await request.get("/opengraph-image")).headers()["content-type"]).toContain("image/png");
});
