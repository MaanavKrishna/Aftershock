import { describe, test, expect } from "vitest";
import { SOURCES, SOURCE_IDS, type Parsed } from "@/lib/integrations/sources";

const NOW = 1_790_000_000_000;
const alertOf = (p: Parsed) => ("alert" in p ? p.alert : null);

describe("every source", () => {
  test.each(SOURCE_IDS)("%s: its test delivery verifies with the right secret, fails with another, and is ignored", (id) => {
    const def = SOURCES[id];
    const secret = def.newSecret();
    const req = def.testRequest(secret, NOW);
    const url = new URL(`http://x/api/webhooks/${id}?workspace=w`);
    expect(def.verify({ body: req.body, headers: new Headers(req.headers), url }, secret, NOW)).toBe(true);
    expect(def.verify({ body: req.body, headers: new Headers(req.headers), url }, def.newSecret(), NOW)).toBe(false);
    expect(def.verify({ body: req.body, headers: new Headers(), url }, secret, NOW)).toBe(false);
    expect("ignored" in def.parse(JSON.parse(req.body))).toBe(true);
  });
  test("only Sentry and PagerDuty ship without the Labs flag", () => {
    expect(SOURCE_IDS.filter((id) => !SOURCES[id].labs)).toEqual(["sentry", "pagerduty"]);
  });
  test("garbage payloads are ignored, never thrown on", () => {
    for (const id of SOURCE_IDS) for (const p of [null, 1, "x", [], {}, { data: null }, { event: 5 }]) expect("ignored" in SOURCES[id].parse(p)).toBe(true);
  });
});

describe("payloads become alerts", () => {
  test("Sentry: a created issue", () => {
    const a = alertOf(SOURCES.sentry.parse({ action: "created", data: { issue: { id: "4512", title: "IntegrityError", culprit: "orders.py in create", project: { slug: "shop" }, permalink: "https://sentry.io/x" } } }));
    expect(a).toMatchObject({ fingerprint: "sentry-4512", title: "IntegrityError", observed: "IntegrityError — orders.py in create", target: "shop", link: "https://sentry.io/x" });
    expect("ignored" in SOURCES.sentry.parse({ action: "resolved", data: { issue: { id: "1" } } })).toBe(true);
  });
  test("PagerDuty: triggered and resolved incidents", () => {
    const a = alertOf(SOURCES.pagerduty.parse({ event: { event_type: "incident.resolved", data: { id: "P8K", title: "Worker crash", service: { summary: "payments" }, html_url: "https://pd/x" } } }));
    expect(a).toMatchObject({ fingerprint: "pd-P8K", target: "payments", link: "https://pd/x" });
    expect("ignored" in SOURCES.pagerduty.parse({ event: { event_type: "incident.acknowledged", data: { id: "P8K" } } })).toBe(true);
  });
  test("incident.io: created and status-updated incidents share one fingerprint", () => {
    const inc = { id: "01H", name: "Checkout 500s", summary: "Totals overflow", permalink: "https://app.incident.io/x", incident_type: { name: "checkout" } };
    const a = alertOf(SOURCES.incidentio.parse({ event_type: "public_incident.incident_created_v2", "public_incident.incident_created_v2": inc }));
    const b = alertOf(SOURCES.incidentio.parse({ event_type: "public_incident.incident_status_updated_v2", "public_incident.incident_status_updated_v2": { incident: inc } }));
    expect(a).toMatchObject({ fingerprint: "incidentio-01H", title: "Checkout 500s", observed: "Totals overflow", target: "checkout", link: "https://app.incident.io/x" });
    expect(b?.fingerprint).toBe("incidentio-01H");
  });
  test("Linear: only issues labelled incident", () => {
    const data = { id: "lin-1", title: "Refund rounds down", description: "Off by a cent", url: "https://linear.app/x", team: { key: "PAY" }, labels: [{ name: "Incident" }] };
    expect(alertOf(SOURCES.linear.parse({ type: "Issue", action: "create", data }))).toMatchObject({ fingerprint: "linear-lin-1", target: "PAY", observed: "Off by a cent", link: "https://linear.app/x" });
    expect("ignored" in SOURCES.linear.parse({ type: "Issue", action: "create", data: { ...data, labels: [{ name: "feature" }] } })).toBe(true);
    expect("ignored" in SOURCES.linear.parse({ type: "Comment", action: "create", data })).toBe(true);
  });
  test("Rootly: created and resolved incidents", () => {
    const a = alertOf(SOURCES.rootly.parse({ event: { type: "incident.created" }, data: { id: "r1", title: "Queue stuck", summary: "Workers idle", url: "https://rootly.com/x", services: [{ name: "worker" }] } }));
    expect(a).toMatchObject({ fingerprint: "rootly-r1", target: "worker", observed: "Workers idle" });
  });
  test("Opsgenie: Create and Close actions", () => {
    const a = alertOf(SOURCES.opsgenie.parse({ action: "Create", alert: { alertId: "og-1", message: "Disk full", description: "on db-1", entity: "db", tags: ["x"] } }));
    expect(a).toMatchObject({ fingerprint: "opsgenie-og-1", title: "Disk full", observed: "on db-1", target: "db" });
    expect("ignored" in SOURCES.opsgenie.parse({ action: "Acknowledge", alert: { alertId: "og-1" } })).toBe(true);
  });
  test("Datadog: the documented payload template, service from tags", () => {
    const a = alertOf(SOURCES.datadog.parse({ id: "agg-1", title: "[Triggered] p99 latency", message: "p99 > 2s", transition: "Triggered", link: "https://app.datadoghq.com/x", tags: "env:prod,service:checkout" }));
    expect(a).toMatchObject({ fingerprint: "datadog-agg-1", target: "checkout", link: "https://app.datadoghq.com/x" });
    expect("ignored" in SOURCES.datadog.parse({ id: "agg-1", title: "t", transition: "Warn" })).toBe(true);
  });
  test("Jira: bugs and incidents, with Atlassian document text and a browse link", () => {
    const issue = { id: "10001", key: "SHOP-7", self: "https://acme.atlassian.net/rest/api/3/issue/10001", fields: { summary: "Cart total wrong", issuetype: { name: "Bug" }, project: { key: "SHOP" }, labels: [], description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Shows" }, { type: "text", text: " $0" }] }] } } };
    expect(alertOf(SOURCES.jira.parse({ webhookEvent: "jira:issue_created", issue }))).toMatchObject({ fingerprint: "jira-10001", title: "SHOP-7: Cart total wrong", observed: "Shows $0", target: "SHOP", link: "https://acme.atlassian.net/browse/SHOP-7" });
    expect("ignored" in SOURCES.jira.parse({ webhookEvent: "jira:issue_created", issue: { ...issue, fields: { ...issue.fields, issuetype: { name: "Story" } } } })).toBe(true);
  });
  test("generic webhook: incident.* events", () => {
    const a = alertOf(SOURCES.webhook.parse({ type: "incident.created", data: { id: "e-1", title: "Late invoices", description: "Cron skipped", service: "billing", url: "https://x" } }));
    expect(a).toMatchObject({ fingerprint: "webhook-e-1", target: "billing", observed: "Cron skipped", link: "https://x" });
  });
  test("links that are not http(s) are dropped", () => {
    const a = alertOf(SOURCES.webhook.parse({ type: "incident.created", data: { id: "e-2", title: "t", url: "javascript:alert(1)" } }));
    expect(a?.link).toBeUndefined();
  });
});

describe("token sources", () => {
  const def = SOURCES.datadog;
  const url = (q = "") => new URL(`http://x/api/webhooks/datadog?workspace=w${q}`);
  test("accept the token as a Bearer header, an X-Aftershock-Token header, or a token query parameter", () => {
    expect(def.verify({ body: "{}", headers: new Headers({ authorization: "Bearer tok" }), url: url() }, "tok", NOW)).toBe(true);
    expect(def.verify({ body: "{}", headers: new Headers({ "x-aftershock-token": "tok" }), url: url() }, "tok", NOW)).toBe(true);
    expect(def.verify({ body: "{}", headers: new Headers(), url: url("&token=tok") }, "tok", NOW)).toBe(true);
    expect(def.verify({ body: "{}", headers: new Headers({ authorization: "Bearer nope" }), url: url() }, "tok", NOW)).toBe(false);
  });
});
