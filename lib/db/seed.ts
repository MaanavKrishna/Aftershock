import { eq } from "drizzle-orm";
import { getDb } from "./client";
import * as s from "./schema";
import type { RunResult } from "@/lib/domain/verdict";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const runs = (outcome: RunResult["outcome"], n = 3, ms = 800): RunResult[] => Array.from({ length: n }, () => ({ outcome, durationMs: ms }));

export const DEMO_LOGIN = "demo";

const INC12_CODE_1 = `# INC-12 · draft 1

def test_payment_is_created_once(client, pending_order):
    response = client.post("/payments", json={"order_id": pending_order.id})
    assert response.status_code == 201
    assert payment_count(pending_order.id) == 1
`;

export const INC12_CODE = `# Aftershock · INC-12 "Payment retry charged a customer twice"
# Proven: fails on 3f2a1c9 (3/3) · passes on aa86f56 (3/3)

def test_retry_after_lost_ack_does_not_double_charge(client, pending_order):
    first = client.post("/payments", json={"order_id": pending_order.id})
    assert first.status_code == 201

    # The acknowledgement is lost. The client retries the same request.
    retry = client.post("/payments", json={"order_id": pending_order.id})

    assert retry.status_code == 400
    assert payment_count(pending_order.id) == 1
`;

const LOG_PROVEN = `$ pytest tests/aftershock/test_inc_12_payment_retry.py -q   # 3f2a1c9
F
>       assert retry.status_code == 400
E       assert 201 == 400
E        +  where 201 = <Response [201]>.status_code
1 failed in 0.84s

$ pytest tests/aftershock/test_inc_12_payment_retry.py -q   # aa86f56
.
1 passed in 0.79s`;

const LOG_REJECTED = `$ pytest tests/aftershock/test_inc_12_payment_retry.py -q   # 3f2a1c9
.
1 passed in 0.71s

Rejected: a test that passes before the fix does not reproduce the incident.
Feedback for the next draft: the incident requires a second identical request.`;

const DIFF_214 = `@@ -16,13 +16,4 @@ def create_mock_payment(db, user_id, order_id):
     if order.status == OrderStatus.PAID:
         raise HTTPException(status_code=400, detail="Order is already paid")

-    existing_pending_payment = db.query(Payment).filter(
-        Payment.order_id == order.id,
-        Payment.user_id == user_id,
-        Payment.status == PaymentStatus.PENDING
-    ).first()
-
-    if existing_pending_payment:
-        raise HTTPException(status_code=400, detail="Pending payment already exists for this order")
-
     payment = Payment(`;

const steps = (state: "proven" | "rejected"): s.RunStep[] =>
  state === "proven"
    ? [
        { key: "load", label: "Load incident and fix", detail: "Issue #41 → PR #44 → aa86f56, parent 3f2a1c9", state: "ok", ms: 400 },
        { key: "context", label: "Read context", detail: "Fix diff, conftest.py, 2 nearby test files", state: "ok", ms: 1100 },
        { key: "draft", label: "Draft test", detail: "Muse Spark · with attempt 1’s failure as feedback", state: "ok", ms: 9800 },
        { key: "before", label: "Run before the fix ×3", detail: "Failed 3/3 — the incident reproduces", state: "ok", ms: 14200 },
        { key: "fix", label: "Run on the fix ×3", detail: "Passed 3/3", state: "ok", ms: 13700 },
        { key: "admit", label: "Admit to memory", detail: "Stored with evidence and both commit SHAs", state: "ok", ms: 200 },
        { key: "pr", label: "Open bot pull request", detail: "PR #219 adds the test file", state: "ok", ms: 1900 },
      ]
    : [
        { key: "load", label: "Load incident and fix", detail: "Issue #41 → PR #44 → aa86f56, parent 3f2a1c9", state: "ok", ms: 500 },
        { key: "context", label: "Read context", detail: "Fix diff, conftest.py, 2 nearby test files", state: "ok", ms: 1200 },
        { key: "draft", label: "Draft test", detail: "Muse Spark", state: "ok", ms: 8600 },
        { key: "before", label: "Run before the fix ×3", detail: "Passed 3/3 — expected failures. Rejected.", state: "bad", ms: 13900 },
        { key: "fix", label: "Run on the fix ×3", detail: "Skipped: nothing to prove", state: "skip" },
        { key: "admit", label: "Admit to memory", detail: "Skipped", state: "skip" },
        { key: "pr", label: "Open bot pull request", detail: "Skipped", state: "skip" },
      ];

const INPUTS = [
  { name: "incident INC-12", note: "title + 3 fields" },
  { name: "fix diff aa86f56", note: "+9 −0" },
  { name: "tests/conftest.py", note: "fixtures" },
  { name: "tests/test_payments.py", note: "style" },
  { name: "app/services/payment_service.py", note: "at parent" },
];

/** Creates the demo workspace once. Safe to call on every request. */
export async function seedDemo(): Promise<{ workspaceId: string; userId: string }> {
  const db = await getDb();
  const [existing] = await db.select().from(s.workspaces).where(eq(s.workspaces.login, DEMO_LOGIN));
  if (existing) {
    const [m] = await db.select().from(s.memberships).where(eq(s.memberships.workspaceId, existing.id));
    return { workspaceId: existing.id, userId: m.userId };
  }

  return db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(s.workspaces)
      .values({ login: DEMO_LOGIN, name: "Demo workspace", settings: { autoImportIssues: true, autoTravelOnMerge: true, issueLabel: "incident" } })
      .returning();
    const [me, a, b] = await tx
      .insert(s.users)
      .values([
        { login: "you", name: "You (demo)" },
        { login: "teammate-a", name: "Teammate A" },
        { login: "teammate-b", name: "Teammate B" },
      ])
      .returning();
    await tx.insert(s.memberships).values([
      { workspaceId: ws.id, userId: me.id, role: "owner" },
      { workspaceId: ws.id, userId: a.id, role: "admin" },
      { workspaceId: ws.id, userId: b.id, role: "member" },
    ]);

    const [eco, web, bill] = await tx
      .insert(s.repositories)
      .values([
        { workspaceId: ws.id, fullName: "Franklindot04/ecommerce-api", name: "ecommerce-api", cloneUrl: "https://github.com/Franklindot04/ecommerce-api.git", language: "Python", framework: "pytest", installCmd: "pip install -r requirements.txt", runner: "sandbox", checkMode: "blocking", lastCheckAt: ago(2) },
        { workspaceId: ws.id, fullName: "demo/storefront-web", name: "storefront-web", cloneUrl: "https://github.com/demo/storefront-web.git", language: "TypeScript", framework: "vitest", installCmd: "npm ci", runner: "actions", checkMode: "blocking", lastCheckAt: ago(60) },
        { workspaceId: ws.id, fullName: "demo/billing-worker", name: "billing-worker", cloneUrl: "https://github.com/demo/billing-worker.git", language: "TypeScript", framework: "jest", installCmd: "npm ci", runner: "sandbox", checkMode: "advisory", lastCheckAt: ago(1500) },
      ])
      .returning();

    type Inc = typeof s.incidents.$inferInsert;
    const base = (n: number, repo: string, extra: Partial<Inc>): Inc => ({ workspaceId: ws.id, number: n, repoId: repo, title: "", source: "form", status: "proven", ...extra });
    const incRows = await tx
      .insert(s.incidents)
      .values([
        base(17, web.id, { title: "Discount applied twice when cart is refreshed", source: "issue", sourceRef: "storefront-web#208", status: "traveling", fixPr: 212, fixSha: "b81f4a2", parentSha: "e09c3d7", watchedFiles: ["src/cart/applyDiscount.ts"], trigger: "A shopper refreshed the cart page while a discount request was in flight.", observed: "The same discount code was applied twice; the order total dropped below cost.", expected: "A discount code applies at most once per cart.", createdAt: ago(30), updatedAt: ago(2) }),
        base(16, eco.id, { title: "IntegrityError in create_order", source: "sentry", sourceRef: "sentry:ecommerce-api/4512", fingerprint: "sentry-4512", status: "awaiting_fix", watchedFiles: ["app/services/order_service.py"], trigger: "Two checkout requests for the same cart arrived within milliseconds.", observed: "sqlalchemy.exc.IntegrityError: duplicate key value violates unique constraint orders_cart_id_key", expected: "The second request returns the existing order.", severity: "SEV-2", createdAt: ago(2880), updatedAt: ago(2880) }),
        base(15, web.id, { title: "Stale order total after editing the cart", source: "postmortem", status: "unproven", statusReason: "Three drafts passed before the fix. Add a hint about the cache, then retry.", fixSha: "c4d2e19", parentSha: "77ab01f", watchedFiles: ["src/cart/total.ts"], trigger: "A shopper changed an item quantity on the cart page.", observed: "The order summary kept the previous total until reload.", expected: "The total reflects the latest quantity immediately.", createdAt: ago(1500), updatedAt: ago(1440) }),
        base(14, bill.id, { title: "Worker crash loop when queue is empty", source: "pagerduty", sourceRef: "pagerduty:P8K2QX", fingerprint: "pd-P8K2QX", status: "awaiting_fix", watchedFiles: ["src/worker/poll.ts"], trigger: "The billing queue drained overnight.", observed: "The worker threw on an empty batch and restarted every few seconds.", expected: "An empty batch is a no-op.", severity: "SEV-2", createdAt: ago(4320), updatedAt: ago(4320) }),
        base(12, eco.id, { title: "Payment retry charged a customer twice", source: "issue", sourceRef: "ecommerce-api#41", severity: "SEV-1", fixSha: "aa86f56", parentSha: "3f2a1c9", fixPr: 44, fixTitle: "fix: reject duplicate pending payment", watchedFiles: ["app/services/payment_service.py", "app/api/payments.py"], trigger: "The payment committed, but the acknowledgement never reached the client. The client retried.", observed: "A second pending payment was created for the same order.", expected: "One order, one charge. The retry is rejected with the documented 400.", epicenter: { sha: "5d0c2e1", prNumber: 31, title: "feat: mock payments endpoint", testedCommits: 4 }, createdAt: ago(7000), updatedAt: ago(5800) }),
        base(9, bill.id, { title: "Refund webhook processed twice", source: "form", fixSha: "71d0a9e", parentSha: "0be3f11", watchedFiles: ["src/webhooks/handler.ts"], trigger: "The payment provider redelivered a refund webhook after a timeout.", observed: "The refund was issued twice.", expected: "Each webhook event id is processed once.", createdAt: ago(14000) }),
        base(7, eco.id, { title: "Webhook marked order paid before capture", source: "issue", sourceRef: "ecommerce-api#37", fixSha: "91c0de2", parentSha: "8a7e6d5", watchedFiles: ["app/services/payment_service.py", "app/api/webhooks.py"], trigger: "An authorisation webhook arrived before capture completed.", observed: "The order was marked PAID while capture later failed.", expected: "An order is PAID only after capture succeeds.", createdAt: ago(24000) }),
        base(6, web.id, { title: "Cart total ignored removed coupon", source: "form", fixSha: "3e9a0b4", parentSha: "1c2d3e4", watchedFiles: ["src/cart/applyDiscount.ts"], trigger: "A shopper removed a coupon after applying it.", observed: "The discounted total remained.", expected: "Removing a coupon restores the full total.", createdAt: ago(28000) }),
        base(5, web.id, { title: "Search returns deleted products", source: "form", status: "rejected", statusReason: "Every draft passed before the fix; the fix commit did not change search behaviour.", fixSha: "aa0011b", parentSha: "99ff00a", watchedFiles: ["src/search/index.ts"], createdAt: ago(37000) }),
        base(4, eco.id, { title: "Order created without stock reservation", source: "issue", sourceRef: "ecommerce-api#22", fixSha: "4f4f4f1", parentSha: "3e3e3e2", watchedFiles: ["app/services/order_service.py"], trigger: "Two shoppers bought the last unit at the same time.", observed: "Both orders succeeded; stock went negative.", expected: "Creating an order reserves stock or fails.", createdAt: ago(40000) }),
        base(3, web.id, { title: "Negative quantity accepted in cart", source: "form", fixSha: "6a6a6a1", parentSha: "5b5b5b2", watchedFiles: ["src/cart/updateItem.ts"], trigger: "A request set quantity to -2.", observed: "The cart total went negative.", expected: "Quantities below 1 are rejected.", createdAt: ago(52000) }),
        base(2, eco.id, { title: "Invoice email sent twice on retry", source: "issue", sourceRef: "ecommerce-api#12", fixSha: "2c2c2c1", parentSha: "1d1d1d2", watchedFiles: ["app/services/invoice_service.py"], trigger: "The invoice job retried after a mail server timeout.", observed: "The customer received two invoices.", expected: "One invoice email per order.", createdAt: ago(56000) }),
      ])
      .returning();
    const inc = Object.fromEntries(incRows.map((r) => [r.number, r]));

    const [r12a, r12b] = await tx
      .insert(s.timeTravelRuns)
      .values([
        { incidentId: inc[12].id, attempt: 1, status: "rejected", reason: "The draft passed before the fix, so it does not reproduce the incident.", feedback: "The previous draft never retried; the incident requires a second identical request.", testPath: "tests/aftershock/test_inc_12_payment_retry.py", testCode: INC12_CODE_1, beforeResults: runs("passed"), fixResults: [], steps: steps("rejected"), log: LOG_REJECTED, inputs: INPUTS, model: "muse-spark-1.3-contributor", tokens: 3900, cpuMs: 9000, wallMs: 24000, createdAt: ago(5811), finishedAt: ago(5811) },
        { incidentId: inc[12].id, attempt: 2, status: "proven", reason: "Failed 3/3 before the fix and passed 3/3 on it.", testPath: "tests/aftershock/test_inc_12_payment_retry.py", testCode: INC12_CODE, beforeResults: runs("failed"), fixResults: runs("passed"), steps: steps("proven"), log: LOG_PROVEN, inputs: INPUTS, model: "muse-spark-1.3-contributor", tokens: 4100, cpuMs: 18000, wallMs: 41000, createdAt: ago(5800), finishedAt: ago(5800) },
        { incidentId: inc[17].id, attempt: 1, status: "running", testPath: "tests/aftershock/inc-17-discount-refresh.test.ts", testCode: "// INC-17 · draft 1\nimport { test, expect } from 'vitest'\n", beforeResults: runs("failed"), fixResults: [], steps: [
          { key: "load", label: "Load incident and fix", detail: "Issue #208 → PR #212 → b81f4a2", state: "ok", ms: 300 },
          { key: "context", label: "Read context", detail: "Fix diff and 2 nearby test files", state: "ok", ms: 900 },
          { key: "draft", label: "Draft test", detail: "Muse Spark", state: "ok", ms: 9100 },
          { key: "before", label: "Run before the fix ×3", detail: "Failed 3/3 — the incident reproduces", state: "ok", ms: 15000 },
          { key: "fix", label: "Run on the fix ×3", detail: "Running", state: "running" },
          { key: "admit", label: "Admit to memory", detail: "Waiting", state: "pending" },
          { key: "pr", label: "Open bot pull request", detail: "Waiting", state: "pending" },
        ], log: "", inputs: [], runner: "sandbox", model: "muse-spark-1.3-contributor", createdAt: ago(3) },
        { incidentId: inc[15].id, attempt: 3, status: "unproven", reason: "Out of drafts: every draft passed before the fix.", testPath: "tests/aftershock/inc-15-stale-total.test.ts", testCode: "// INC-15 · draft 3\n", beforeResults: runs("passed"), steps: [], log: "", inputs: [], model: "muse-spark-1.3-contributor", createdAt: ago(1440), finishedAt: ago(1440) },
        { incidentId: inc[5].id, attempt: 1, status: "rejected", reason: "The draft passed before the fix, so it does not reproduce the incident.", testPath: "tests/aftershock/inc-05-search-deleted.test.ts", testCode: "// INC-05 · draft 1\n", beforeResults: runs("passed"), steps: [], log: "", inputs: [], model: "muse-spark-1.3-contributor", createdAt: ago(36000), finishedAt: ago(36000) },
      ])
      .returning();
    void r12a;

    const night = (fails: number[]) => Array.from({ length: 14 }, (_, i) => !fails.includes(i));
    const mem = await tx
      .insert(s.memoryTests)
      .values([
        { workspaceId: ws.id, incidentId: inc[12].id, repoId: eco.id, runId: r12b.id, path: "tests/aftershock/test_inc_12_payment_retry.py", fn: "test_retry_after_lost_ack_does_not_double_charge", code: INC12_CODE, botPr: 219, botPrState: "open", health: "healthy", nights: night([]), provenAt: ago(5800) },
        { workspaceId: ws.id, incidentId: inc[9].id, repoId: bill.id, path: "tests/aftershock/inc-09-refund-webhook.test.ts", fn: "refund webhook is idempotent per event id", botPr: 88, botPrState: "merged", health: "healthy", nights: night([]), provenAt: ago(14000) },
        { workspaceId: ws.id, incidentId: inc[7].id, repoId: eco.id, path: "tests/aftershock/test_inc_07_capture.py", fn: "test_order_paid_only_after_capture", botPr: 39, botPrState: "merged", health: "healthy", nights: night([]), provenAt: ago(24000) },
        { workspaceId: ws.id, incidentId: inc[6].id, repoId: web.id, path: "tests/aftershock/inc-06-coupon.test.ts", fn: "cart total drops coupon after removal", botPr: 190, botPrState: "merged", health: "flaky", nights: night([6]), provenAt: ago(28000) },
        { workspaceId: ws.id, incidentId: inc[4].id, repoId: eco.id, path: "tests/aftershock/test_inc_04_stock.py", fn: "test_order_reserves_stock", botPr: 25, botPrState: "merged", health: "healthy", nights: night([]), provenAt: ago(40000) },
        { workspaceId: ws.id, incidentId: inc[3].id, repoId: web.id, path: "tests/aftershock/inc-03-quantity.test.ts", fn: "rejects negative cart quantities", botPr: 171, botPrState: "merged", health: "failing", nights: night([12, 13]), provenAt: ago(52000) },
        { workspaceId: ws.id, incidentId: inc[2].id, repoId: eco.id, path: "tests/aftershock/test_inc_02_invoice.py", fn: "test_invoice_sent_once_per_order", botPr: 14, botPrState: "merged", health: "healthy", nights: night([]), provenAt: ago(56000) },
      ])
      .returning();
    const memBy = Object.fromEntries(mem.map((m) => [incRows.find((i) => i.id === m.incidentId)!.number, m]));

    type Chk = typeof s.prChecks.$inferInsert;
    const chk = (pr: number, repo: string, title: string, verdict: Chk["verdict"], runner: string | null, files: string[], minutes: number, extra: Partial<Chk> = {}): Chk => ({
      workspaceId: ws.id, repoId: repo, prNumber: pr, title, headSha: Math.random().toString(16).slice(2, 9), baseSha: "aa86f56", filesChanged: files.length, changedFiles: files, status: verdict ? "done" : "running", verdict, runner, durationMs: verdict && verdict !== "skipped" ? 30_000 + pr * 100 : null, createdAt: ago(minutes), ...extra,
    });
    const checks = await tx
      .insert(s.prChecks)
      .values([
        chk(222, eco.id, "feat: saved payment methods", null, "sandbox", ["app/services/payment_service.py", "app/api/payments.py", "app/models.py", "app/schemas.py"], 1),
        chk(221, web.id, "feat: gift cards at checkout", "safe", "actions", ["src/cart/applyDiscount.ts", "src/cart/giftCard.ts", "src/cart/total.ts", "src/ui/Checkout.tsx", "src/ui/GiftCard.tsx", "src/api/giftCards.ts", "src/cart/types.ts"], 60, { durationMs: 72_000 }),
        chk(220, eco.id, "chore: bump fastapi to 0.115", "safe", "sandbox", ["requirements.txt", "app/main.py"], 1100, { durationMs: 58_000 }),
        chk(218, bill.id, "fix: retry webhook on 502", "inconclusive", "sandbox", ["src/webhooks/handler.ts"], 200, { durationMs: 33_000 }),
        chk(217, eco.id, "docs: update README", "skipped", null, ["README.md"], 300),
        chk(216, eco.id, "feat: partial refunds", "safe", "actions", ["app/services/payment_service.py", "app/api/refunds.py", "app/models.py", "app/schemas.py", "tests/test_refunds.py"], 5000, { durationMs: 61_000 }),
        chk(214, eco.id, "refactor: simplify payment service", "recur", "sandbox", ["app/services/payment_service.py"], 5778, { headSha: "7c41e0b", durationMs: 41_000, diff: DIFF_214 }),
        chk(213, web.id, "refactor: cart reducer", "safe", "sandbox", ["src/cart/reducer.ts", "src/cart/applyDiscount.ts", "src/cart/total.ts"], 6500, { durationMs: 38_000 }),
      ])
      .returning();
    const byPr = Object.fromEntries(checks.map((c) => [c.prNumber, c]));
    const trace214: s.TraceStep[] = [
      { head: "POST /payments", sub: "201 · payment committed" },
      { head: "acknowledgement lost", sub: "test discards the first response" },
      { head: "POST /payments · retry", sub: "201 · second payment committed", bad: true },
      { head: "payment_count(order)", sub: "2 rows", bad: true },
    ];
    const okTrace = (act: string): s.TraceStep[] => [
      { head: "arrange", sub: "fixtures from tests/conftest.py" },
      { head: "act", sub: act },
      { head: "assert", sub: "all assertions held" },
    ];
    await tx.insert(s.prCheckResults).values([
      { checkId: byPr[214].id, memoryTestId: memBy[12].id, selectedBy: "files", why: "Touches app/services/payment_service.py", runs: runs("failed"), verdict: "recur", failureExcerpt: "AssertionError: assert 201 == 400 · payment rows: 2", trace: trace214 },
      { checkId: byPr[214].id, memoryTestId: memBy[7].id, selectedBy: "files", why: "Touches app/services/payment_service.py", runs: runs("passed"), verdict: "safe", trace: okTrace("Touches app/services/payment_service.py") },
      { checkId: byPr[214].id, memoryTestId: memBy[2].id, selectedBy: "triage", why: "Added by triage: same retry path", runs: runs("passed"), verdict: "safe", trace: okTrace("Added by triage: same retry path") },
      { checkId: byPr[221].id, memoryTestId: memBy[6].id, selectedBy: "files", why: "Touches src/cart/applyDiscount.ts", runs: runs("passed"), verdict: "safe", trace: okTrace("Touches src/cart/applyDiscount.ts") },
      { checkId: byPr[221].id, memoryTestId: memBy[3].id, selectedBy: "triage", why: "Added by triage: cart quantity rules", runs: runs("passed"), verdict: "safe", trace: okTrace("Added by triage") },
      { checkId: byPr[220].id, memoryTestId: memBy[12].id, selectedBy: "triage", why: "Added by triage: framework upgrade", runs: runs("passed"), verdict: "safe", trace: okTrace("framework upgrade") },
      { checkId: byPr[218].id, memoryTestId: memBy[9].id, selectedBy: "files", why: "Touches src/webhooks/handler.ts", runs: [{ outcome: "passed", durationMs: 700 }, { outcome: "passed", durationMs: 690 }, { outcome: "failed", durationMs: 720 }], verdict: "inconclusive", failureExcerpt: "Expected 1 refund, received 2 (run 3 only)", trace: okTrace("Touches src/webhooks/handler.ts") },
      { checkId: byPr[216].id, memoryTestId: memBy[12].id, selectedBy: "files", why: "Touches app/services/payment_service.py", runs: runs("passed"), verdict: "safe", trace: okTrace("Touches app/services/payment_service.py") },
      { checkId: byPr[216].id, memoryTestId: memBy[7].id, selectedBy: "files", why: "Touches app/services/payment_service.py", runs: runs("passed"), verdict: "safe", trace: okTrace("Touches app/services/payment_service.py") },
      { checkId: byPr[213].id, memoryTestId: memBy[6].id, selectedBy: "files", why: "Touches src/cart/applyDiscount.ts", runs: runs("passed"), verdict: "safe", trace: okTrace("Touches src/cart/applyDiscount.ts") },
    ]);
    await tx.insert(s.prCheckSkips).values([
      { checkId: byPr[214].id, incidentId: inc[4].id, reason: "No overlap with order_service.py; triage: unrelated" },
      { checkId: byPr[214].id, incidentId: inc[16].id, reason: "Awaiting fix — no proven test yet" },
      { checkId: byPr[214].id, incidentId: inc[3].id, reason: "Different repository" },
      { checkId: byPr[214].id, incidentId: inc[6].id, reason: "Different repository" },
      { checkId: byPr[217].id, incidentId: inc[12].id, reason: "Only documentation changed" },
    ]);

    await tx.insert(s.notes).values({ incidentId: inc[12].id, userId: me.id, text: "Two customers were charged twice before we caught this. Never again.", createdAt: ago(5815) });

    await tx.insert(s.integrations).values([
      { workspaceId: ws.id, kind: "sentry", config: { rule: "level ≥ error · projects: ecommerce-api, storefront-web", secretHint: "3f9a" } },
      { workspaceId: ws.id, kind: "pagerduty", config: { services: "payments → ecommerce-api · workers → billing-worker", secretHint: "a71c" } },
      { workspaceId: ws.id, kind: "model", config: { provider: "muse", model: "muse-spark-1.3-contributor" } },
    ]);
    await tx.insert(s.deliveries).values([
      { workspaceId: ws.id, kind: "github", event: "pull_request.synchronize", detail: "#214 · signature ok", ok: true, createdAt: ago(5779) },
      { workspaceId: ws.id, kind: "github", event: "check_run.rerequested", detail: "#218 · signature ok", ok: true, createdAt: ago(190) },
      { workspaceId: ws.id, kind: "github", event: "issues.closed", detail: "#41 labelled incident", ok: true, createdAt: ago(7000) },
      { workspaceId: ws.id, kind: "sentry", event: "issue.created · IntegrityError", detail: "ecommerce-api → INC-16", ok: true, createdAt: ago(2880) },
      { workspaceId: ws.id, kind: "sentry", event: "unsigned request", detail: "rejected · 401", ok: false, createdAt: ago(8000) },
      { workspaceId: ws.id, kind: "pagerduty", event: "incident.resolved · worker crash loop", detail: "billing-worker → INC-14", ok: true, createdAt: ago(4320) },
      { workspaceId: ws.id, kind: "model", event: "draft · INC-17", detail: "9.8s · 4.1k tokens", ok: true, createdAt: ago(3) },
      { workspaceId: ws.id, kind: "model", event: "triage · PR #222", detail: "1.2s · 1.3k tokens", ok: true, createdAt: ago(1) },
    ]);
    await tx.insert(s.activity).values([
      { workspaceId: ws.id, incidentId: inc[17].id, title: "INC-17 time travel started", detail: "storefront-web", tone: "pending", createdAt: ago(3) },
      { workspaceId: ws.id, incidentId: inc[16].id, title: "INC-16 opened from Sentry alert", detail: "Awaiting fix", tone: "neutral", createdAt: ago(2880) },
      { workspaceId: ws.id, incidentId: inc[15].id, title: "INC-15 unproven after 3 drafts", detail: "Every draft passed before the fix", tone: "neutral", createdAt: ago(1440) },
      { workspaceId: ws.id, incidentId: inc[12].id, title: "PR #214 blocked: INC-12 would recur", detail: "refactor: simplify payment service", tone: "fail", createdAt: ago(5778) },
      { workspaceId: ws.id, incidentId: inc[12].id, title: "Bot opened PR #219 with the test", detail: "tests/aftershock/test_inc_12_payment_retry.py", tone: "neutral", createdAt: ago(5799) },
      { workspaceId: ws.id, incidentId: inc[12].id, title: "INC-12 proven · 3/3 fail, 3/3 pass", detail: "Attempt 2", tone: "pass", createdAt: ago(5800) },
      { workspaceId: ws.id, incidentId: inc[12].id, title: "INC-12 draft 1 rejected", detail: "Passed before the fix — did not reproduce", tone: "neutral", createdAt: ago(5811) },
      { workspaceId: ws.id, incidentId: inc[12].id, title: "Fix linked automatically", detail: "PR #44 → aa86f56", tone: "pass", createdAt: ago(7000) },
      { workspaceId: ws.id, incidentId: inc[12].id, title: "Imported from issue #41", detail: "label: incident · SEV-1", tone: "pass", createdAt: ago(7001) },
    ]);
    const month = new Date().toISOString().slice(0, 7);
    await tx.insert(s.usage).values({ workspaceId: ws.id, month, sandboxCpuMs: 5_040_000, drafts: 31 });
    await tx.insert(s.apiTokens).values([
      { workspaceId: ws.id, name: "GitHub Action · storefront-web", prefix: "as_live_••••8c2e", hash: "demo-hash-1", lastUsedAt: ago(60) },
      { workspaceId: ws.id, name: "Local CLI", prefix: "as_live_••••19fd", hash: "demo-hash-2", lastUsedAt: ago(4320) },
    ]);
    return { workspaceId: ws.id, userId: me.id };
  });
}
