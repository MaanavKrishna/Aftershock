import { describe, test, expect } from "vitest";
import { nextDelayMs, MAX_ATTEMPTS, slackMessage, webhookRequest, NOTIFY_EVENTS } from "@/lib/notify/format";
import { verifyStandardWebhook } from "@/lib/integrations/signatures";

const payload = { event: "pr.blocked" as const, title: "PR #41 blocked: INC-3 would recur", detail: "Refactor <cart> & totals", tone: "fail", incident: "INC-3", url: "https://aftershock-mk.vercel.app/incidents/3", workspace: "acme", createdAt: "2026-10-24T10:00:00.000Z" };

describe("slackMessage", () => {
  test("has a plain-text fallback, escapes Slack control characters and links the incident", () => {
    const m = slackMessage(payload);
    expect(m.text).toBe("PR #41 blocked: INC-3 would recur");
    const s = JSON.stringify(m.blocks);
    expect(s).toContain("Refactor &lt;cart&gt; &amp; totals");
    expect(s).toContain("<https://aftershock-mk.vercel.app/incidents/3|INC-3>");
    expect(s).not.toContain("<cart>");
  });
});

describe("webhookRequest", () => {
  test("is signed with Standard Webhooks so receivers can verify it", () => {
    const secret = "whsec_" + Buffer.from("outbound-secret-for-tests").toString("base64");
    const now = 1_790_000_000_000;
    const r = webhookRequest("ntf_1", payload, secret, now);
    expect(JSON.parse(r.body)).toMatchObject({ id: "ntf_1", type: "pr.blocked", data: { title: payload.title, incident: "INC-3" } });
    expect(verifyStandardWebhook(r.body, { id: r.headers["webhook-id"], timestamp: r.headers["webhook-timestamp"], signature: r.headers["webhook-signature"] }, secret, now)).toBe(true);
    expect(r.headers["content-type"]).toBe("application/json");
  });
});

describe("back-off", () => {
  test("30s, 2m, 10m, 1h, then give up", () => {
    expect([1, 2, 3, 4].map(nextDelayMs)).toEqual([30_000, 120_000, 600_000, 3_600_000]);
    expect(nextDelayMs(MAX_ATTEMPTS)).toBeNull();
  });
  test("every event has a label", () => {
    expect(Object.keys(NOTIFY_EVENTS).length).toBe(10);
  });
});
