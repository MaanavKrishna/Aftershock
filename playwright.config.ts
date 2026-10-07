import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", headless: true, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/signin",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...(process.env as Record<string, string>), AFTERSHOCK_DEMO: "1", AFTERSHOCK_DB: "memory", AFTERSHOCK_INLINE_WORKFLOWS: "1", AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e" },
  },
});
