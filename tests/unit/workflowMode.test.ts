import { test, expect } from "vitest";
import { durable } from "@/lib/workflows/start";

// Must match next.config.ts: whenever the build compiles workflows, they can only be started, never called.
test("workflows are durable exactly when the build compiles them", () => {
  expect(durable({ NODE_ENV: "development" })).toBe(false);
  expect(durable({ NODE_ENV: "test" })).toBe(false);
  expect(durable({ NODE_ENV: "development", AFTERSHOCK_WORKFLOWS: "durable" })).toBe(true);
  expect(durable({ NODE_ENV: "development", VERCEL: "1" })).toBe(true);
  // Self-hosted `next start` (the Docker image sets AFTERSHOCK_WORKFLOWS=inline): still compiled, so durable.
  expect(durable({ NODE_ENV: "production", AFTERSHOCK_WORKFLOWS: "inline" })).toBe(true);
});
