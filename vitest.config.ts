import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    env: { AFTERSHOCK_DB: "memory", AUTH_SECRET: "test-secret-test-secret-test-secret-32" },
  },
});
