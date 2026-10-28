import { test, expect } from "@playwright/test";
import { signInDemo } from "./helpers";

test("app pages run under a nonce-based script policy and nothing is blocked", async ({ page }) => {
  const refused: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to (execute|load)/i.test(m.text())) refused.push(m.text());
  });
  await signInDemo(page);
  const res = await page.goto("/incidents/12");
  const csp = res!.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]{16,}' 'strict-dynamic'/);
  expect(csp).not.toContain("'unsafe-inline' 'nonce");
  await page.waitForLoadState("networkidle");
  // Interactive features still work under the policy.
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("combobox", { name: /Search pages, actions and incidents/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.goto("/insights");
  await page.waitForLoadState("networkidle");
  expect(refused).toEqual([]);
});
