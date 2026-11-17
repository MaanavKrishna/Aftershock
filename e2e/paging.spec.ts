import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { signInDemo } from "./helpers";

/** The incident keys in the Incidents table, top to bottom. */
async function keys(page: Page) {
  const table = page.getByRole("region", { name: "Incidents" });
  await expect(table).toBeVisible();
  return (await table.locator("tbody tr td:first-child").allTextContents()).map((k) => k.trim());
}

test("incidents page through with Next page, without skipping or repeating, and First page goes back", async ({ page }) => {
  await signInDemo(page);
  // `limit` is honoured on the in-memory test database only, so a few seeded incidents span several pages.
  await page.goto("/incidents?limit=200");
  const all = await keys(page);
  expect(all.length).toBeGreaterThan(4);

  await page.goto("/incidents?limit=2");
  const pager = page.getByRole("navigation", { name: "Incident pages" });
  await expect(pager.getByRole("link", { name: "First page" })).toHaveCount(0);
  const first = await keys(page);
  expect(first).toEqual(all.slice(0, 2));

  const seen = [...first];
  for (let i = 0; i < 20 && (await pager.getByRole("link", { name: "Next page" }).count()); i++) {
    const prev = await keys(page);
    await pager.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/[?&]cursor=/);
    await expect(page).toHaveURL(/[?&]limit=2/);
    await expect.poll(() => keys(page)).not.toEqual(prev);
    const rows = await keys(page);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(2);
    seen.push(...rows);
    await expect(pager.getByRole("link", { name: "First page" })).toBeVisible();
  }
  expect(seen).toEqual(all);

  await pager.getByRole("link", { name: "First page" }).click();
  await expect(page).not.toHaveURL(/cursor=/);
  expect(await keys(page)).toEqual(first);
});

test("paging keeps the status filter, and changing the filter starts over", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/incidents?status=proven&limit=1");
  await page.getByRole("navigation", { name: "Incident pages" }).getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/status=proven/);
  await expect(page).toHaveURL(/cursor=/);
  await expect(page.getByRole("region", { name: "Incidents" }).getByText("Proven").first()).toBeVisible();
  await page.getByRole("navigation", { name: "Filter by status" }).getByRole("link", { name: /^All/ }).click();
  await expect(page).not.toHaveURL(/cursor=/);
});

test("a malformed cursor falls back to the first page", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/incidents?limit=2");
  const first = await keys(page);
  await page.goto("/incidents?limit=2&cursor=not-a-cursor");
  expect(await keys(page)).toEqual(first);
});

test("the audit log pages too", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/settings?tab=team");
  for (const role of ["admin", "member"]) {
    const row = page.getByRole("group", { name: /teammate-b/ });
    await row.getByRole("combobox", { name: "Role" }).selectOption(role);
    await row.getByRole("button", { name: "Update role" }).click();
    // The select shows the choice at once; reload to be sure the server saved it before the next change.
    await page.waitForLoadState("networkidle");
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole("group", { name: /teammate-b/ }).getByRole("combobox", { name: "Role" })).toHaveValue(role, { timeout: 1000 });
    }).toPass();
  }
  await page.goto("/settings?tab=audit&limit=1");
  const entries = page.getByRole("region", { name: "Audit log entries" }).locator("tbody tr");
  await expect(entries).toHaveCount(1);
  const firstText = await entries.first().textContent();
  await page.getByRole("navigation", { name: "Audit log pages" }).getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/tab=audit/);
  await expect(page).toHaveURL(/cursor=/);
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).not.toHaveText(firstText!);
});

test("the audit log's Export CSV link downloads a CSV with a header row", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/settings?tab=audit");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^aftershock-audit-\d{4}-\d{2}-\d{2}\.csv$/);
  const body = await readFile((await download.path())!, "utf8");
  expect(body.split("\r\n")[0]).toBe("time,actor,action,target,detail,id");
  await expect(page.getByRole("link", { name: "Export JSON" })).toHaveAttribute("href", "/api/v1/audit?format=json");
});
