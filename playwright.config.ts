import { defineConfig } from "@playwright/test";

/** E2E_PORT lets the suite run beside another dev server on 3000. */
const port = Number(process.env.E2E_PORT ?? 3000);
/** E2E_PROD=1 tests the production build (`next build` + `next start`), including its strict CSP, instead of `next dev`. */
const prod = process.env.E2E_PROD === "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  // CI keeps an HTML report next to the traces, uploaded when the suite fails.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: prod ? `npx next build && npx next start --hostname 127.0.0.1 --port ${port}` : `npx next dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/signin`,
    reuseExistingServer: false,
    timeout: prod ? 600_000 : 180_000,
    env: { ...(process.env as Record<string, string>), AFTERSHOCK_DEMO: "1", AFTERSHOCK_DB: "memory", AFTERSHOCK_INLINE_WORKFLOWS: "1", AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e" },
  },
});
