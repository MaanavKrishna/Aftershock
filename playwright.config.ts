import { defineConfig } from "@playwright/test";

/** E2E_PORT lets the suite run beside another dev server on 3000. */
const port = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `npx next dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/signin`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...(process.env as Record<string, string>), AFTERSHOCK_DEMO: "1", AFTERSHOCK_DB: "memory", AFTERSHOCK_INLINE_WORKFLOWS: "1", AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e" },
  },
});
