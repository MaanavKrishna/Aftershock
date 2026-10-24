import { describe, test, expect } from "vitest";
import { extractPaths, similarIncidents } from "@/lib/domain/similar";

describe("extractPaths", () => {
  test("finds file paths in stack traces and culprits", () => {
    expect(extractPaths('File "/app/app/services/order_service.py", line 42, in create_order\napp/services/order_service.py in create_order\n  at applyDiscount (src/cart/applyDiscount.ts:12:5)')).toEqual(["app/services/order_service.py", "src/cart/applyDiscount.ts"]);
  });
  test("ignores URLs and versions", () => {
    expect(extractPaths("see https://sentry.io/x/y.html and v1.2.3")).toEqual([]);
  });
});

describe("similarIncidents", () => {
  const past = [
    { id: "a", key: "INC-16", title: "IntegrityError in create_order", observed: "duplicate key value violates unique constraint orders_cart_id_key", watchedFiles: ["app/services/order_service.py"] },
    { id: "b", key: "INC-14", title: "Worker crash loop when queue is empty", observed: "worker threw on an empty batch", watchedFiles: ["src/worker/poll.ts"] },
  ];
  test("the same error in the same file is a likely recurrence", () => {
    const r = similarIncidents({ title: "IntegrityError: duplicate key value violates unique constraint", observed: "app/services/order_service.py in create_order" }, past);
    expect(r[0]).toMatchObject({ id: "a", key: "INC-16" });
    expect(r[0].score).toBeGreaterThanOrEqual(0.5);
    expect(r[0].why).toMatch(/order_service\.py/);
  });
  test("unrelated incidents don't match", () => {
    expect(similarIncidents({ title: "Checkout button enabled with an empty cart", observed: "" }, past)).toEqual([]);
  });
  test("an incident never matches itself", () => {
    expect(similarIncidents({ id: "a", title: past[0].title, observed: past[0].observed }, past)).toEqual([]);
  });
});
