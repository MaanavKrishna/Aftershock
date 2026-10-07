import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

const site: [string, RegExp][] = [
  ["/", /Every incident becomes a test/],
  ["/pricing", /Pay for proof/],
  ["/security", /We run your code/],
  ["/docs", /Quickstart/],
  ["/signin", /Your last incident is waiting/],
];

for (const [path, heading] of site) {
  test(`marketing ${path} renders its headline`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  });
}

test("signed-out app routes redirect to sign in", async ({ page }) => {
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/signin/);
});

test.describe("product app (demo workspace)", () => {
  test.beforeEach(async ({ page }) => signInDemo(page));

  const app: [string, RegExp][] = [
    ["/overview", /decisions? (is|are) waiting on you|Nothing is waiting on you/],
    ["/incidents", /A failure is a starting point/],
    ["/incidents/new", /Bring an incident in/],
    ["/incidents/12", /Payment retry charged a customer twice/],
    ["/incidents/12/travel", /The test reproduces INC-12 and the fix stops it/],
    ["/memory", /lessons? your codebase can’t forget/],
    ["/pulls", /Every change, checked against what already broke/],
    ["/pulls/214", /This change would ship INC-12 again/],
    ["/repositories", /Where checks run/],
    ["/integrations", /Where incidents come from/],
    ["/settings", /Workspace/],
    ["/onboarding", /Choose repositories/],
  ];
  for (const [path, heading] of app) {
    test(`${path} renders`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    });
  }

  test("status filter shows only proven incidents", async ({ page }) => {
    await page.goto("/incidents?status=proven");
    const statuses = page.getByTestId("incident-status");
    await expect(statuses.first()).toBeVisible();
    for (const t of await statuses.allTextContents()) expect(t).toBe("Proven");
  });

  test("attempt 1 of the time travel shows the rejected draft", async ({ page }) => {
    await page.goto("/incidents/12/travel?attempt=1");
    await expect(page.getByText("REJECTED", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/passed before the fix/);
  });

  test("changing a repository's runner persists", async ({ page }) => {
    await page.goto("/repositories");
    const group = page.getByRole("group", { name: "Runner for ecommerce-api" });
    await group.getByRole("button", { name: "Actions" }).click();
    await expect(group.getByRole("button", { name: "Actions" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("group", { name: "Runner for ecommerce-api" }).getByRole("button", { name: "Actions" })).toHaveAttribute("aria-pressed", "true");
  });

  test("a manual incident can be recorded and opened", async ({ page }) => {
    await page.goto("/incidents/new?tab=form");
    await page.getByLabel("Title").fill("Checkout total rounded wrong");
    await page.getByLabel("Trigger").fill("A cart with three items at 0.10 each");
    await page.getByLabel("Observed").fill("Total showed 0.30000000000000004");
    await page.getByLabel("Expected").fill("Total shows 0.30");
    await page.getByRole("button", { name: "Save only" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Checkout total rounded wrong");
    await expect(page.getByText("Awaiting fix").first()).toBeVisible();
  });

  test("keyboard reaches the source tabs on the new incident page", async ({ page }) => {
    await page.goto("/incidents/new");
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const name = await page.evaluate(() => document.activeElement?.textContent ?? "");
      if (name.includes("Postmortem")) return;
    }
    throw new Error("Postmortem tab not reachable by keyboard");
  });

  test("app routes fit a 390px phone without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/overview", "/incidents", "/incidents/12", "/incidents/12/travel", "/memory", "/pulls", "/pulls/214", "/repositories", "/integrations", "/settings"]) {
      await page.goto(path);
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(fits, path).toBe(true);
    }
  });
});
