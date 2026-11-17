import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { signInDemo } from "./helpers";

/**
 * README screenshots, and an optional visual sweep. Skipped unless SCREENSHOTS_DIR is set.
 *
 *   SCREENSHOTS_DIR=docs/images npx playwright test e2e/visual.spec.ts
 *     → app-incident.png, app-pulls.png, app-insights.png, site-home.png (1440×900 at 2x, dark theme)
 *   VISUAL_SWEEP=1 SCREENSHOTS_DIR=/tmp/shots npx playwright test e2e/visual.spec.ts
 *     → also sweep/<route>-<width>-<theme>.png for every public and app route, 1440 and 390 wide, light and dark
 */
const DIR = process.env.SCREENSHOTS_DIR;
const SWEEP = process.env.VISUAL_SWEEP === "1";

type Theme = "light" | "dark";

const PUBLIC_ROUTES = [
  "/", "/product", "/agents", "/evidence", "/connect", "/connect/sentry", "/pricing", "/security", "/compare",
  "/changelog", "/docs", "/docs/integrations", "/privacy", "/terms", "/signin", "/styleguide",
];
const APP_ROUTES = [
  "/overview", "/incidents", "/incidents/new", "/incidents/12", "/incidents/12/travel", "/incidents/12/evidence",
  "/memory", "/pulls", "/pulls/214", "/insights", "/repositories", "/integrations", "/settings", "/onboarding",
];

async function newThemedPage(browser: Browser, baseURL: string | undefined, theme: Theme, width: number, height: number) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: "reduce", // effects rest on their final frame
  });
  // The theme script reads this before first paint (lib/theme.ts).
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("as-theme", t);
    } catch {}
  }, theme);
  return { context, page: await context.newPage() };
}

/** Wait for the page to be still: its h1, its fonts, then a short settle. */
async function settle(page: Page, theme: Theme) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    // The Next.js dev indicator is not part of the product.
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
  }, theme);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(500);
}

const fileName = (route: string) => (route === "/" ? "home" : route.slice(1).replace(/[^a-z0-9]+/gi, "-"));

test.describe("README screenshots", () => {
  test.skip(!DIR, "Set SCREENSHOTS_DIR to capture screenshots");
  test.describe.configure({ mode: "serial" });

  test("site home, incident, pull request check and insights", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    fs.mkdirSync(DIR!, { recursive: true });
    const { context, page } = await newThemedPage(browser, baseURL, "dark", 1440, 900);

    await page.goto("/");
    await settle(page, "dark");
    await page.screenshot({ path: path.join(DIR!, "site-home.png") });

    await signInDemo(page);
    const shots: [string, string][] = [
      ["/incidents/12", "app-incident.png"],
      ["/pulls/214", "app-pulls.png"],
      ["/insights", "app-insights.png"],
    ];
    for (const [route, name] of shots) {
      await page.goto(route);
      await settle(page, "dark");
      await page.screenshot({ path: path.join(DIR!, name) });
    }
    await context.close();
  });
});

test.describe("visual sweep", () => {
  test.skip(!DIR || !SWEEP, "Set VISUAL_SWEEP=1 and SCREENSHOTS_DIR to sweep every route");

  for (const width of [1440, 390]) {
    for (const theme of ["light", "dark"] as const) {
      test(`every route at ${width} in ${theme}`, async ({ browser, baseURL }) => {
        test.setTimeout(600_000);
        const out = path.join(DIR!, "sweep");
        fs.mkdirSync(out, { recursive: true });
        const { context, page } = await newThemedPage(browser, baseURL, theme, width, width === 390 ? 844 : 900);
        const shoot = async (route: string) => {
          await page.goto(route);
          await settle(page, theme);
          await page.screenshot({ path: path.join(out, `${fileName(route)}-${width}-${theme}.png`), fullPage: true });
        };
        for (const route of PUBLIC_ROUTES) await shoot(route);
        await signInDemo(page);
        for (const route of APP_ROUTES) await shoot(route);
        await context.close();
      });
    }
  }
});
