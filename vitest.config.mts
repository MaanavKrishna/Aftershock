import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname, "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    env: { AFTERSHOCK_DB: "memory", AUTH_SECRET: "test-secret-test-secret-test-secret-32" },
  },
});
