import { createHmac, randomBytes } from "node:crypto";
import type { IntakeKind } from "@/lib/db/schema";
import type { Alert } from "./intake";
import { newStandardSecret, signStandardWebhook, verifyLinear, verifyPagerDuty, verifySentry, verifyStandardWebhook, verifyToken } from "./signatures";

export type Parsed = { alert: Alert } | { ignored: string };
export type Delivery = { body: string; headers: Headers; url: URL };

export type SourceDef = {
  id: IntakeKind;
  label: string;
  text: string;
  icon: string;
  /** Behind the intakeExtra Labs flag. */
  labs: boolean;
  /** "signature": the body is HMAC-signed. "token": a shared token is sent with each delivery. */
  auth: "signature" | "token";
  /** Who creates the secret: the provider (paste it here) or Aftershock (generate it here). */
  secretFrom: "provider" | "aftershock";
  mapping: { key: string; label: string; placeholder: string };
  setup: string;
  verify(d: Delivery, secret: string, now: number): boolean;
  parse(payload: unknown): Parsed;
  newSecret(): string;
  /** A signed, harmless delivery the source would ignore; used by "Send test delivery". */
  testRequest(secret: string, now: number): { body: string; headers: Record<string, string> };
};

type J = Record<string | number, unknown>;
const at = (v: unknown, ...path: (string | number)[]): unknown => path.reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as J)[k] : undefined), v);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const link = (v: unknown): string | undefined => {
  try {
    const s = str(v).trim();
    const u = new URL(s);
    return (u.protocol === "https:" || u.protocol === "http:") && s.length <= 2000 ? s : undefined;
  } catch {
    return undefined;
  }
};
const hex = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("hex");
const hexSecret = () => randomBytes(24).toString("hex");
const alert = (a: Alert): Parsed => ({ alert: { ...a, title: a.title || "Untitled alert", observed: a.observed || a.title } });

/** Atlassian document format → plain text. */
function adf(n: unknown): string {
  if (typeof n === "string") return n;
  if (at(n, "type") === "text") return str(at(n, "text"));
  return list(at(n, "content")).map(adf).join(at(n, "type") === "doc" ? "\n" : "");
}

/** Token sources accept the token as a Bearer header, an X-Aftershock-Token header, or (for tools that can't set headers) ?token=. */
function tokenOf(d: Delivery): string | null {
  const auth = d.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return d.headers.get("x-aftershock-token") ?? d.url.searchParams.get("token");
}
const tokenAuth = {
  auth: "token" as const,
  secretFrom: "aftershock" as const,
  verify: (d: Delivery, secret: string) => verifyToken(tokenOf(d), secret),
  newSecret: hexSecret,
};
const tokenTest = (body: object) => (secret: string) => ({ body: JSON.stringify(body), headers: { authorization: `Bearer ${secret}` } });

const standard = {
  auth: "signature" as const,
  verify: (d: Delivery, secret: string, now: number) =>
    verifyStandardWebhook(d.body, { id: d.headers.get("webhook-id"), timestamp: d.headers.get("webhook-timestamp"), signature: d.headers.get("webhook-signature") }, secret, now),
  newSecret: newStandardSecret,
  testRequest: (secret: string, now: number, body = JSON.stringify({ event_type: "aftershock.ping" })) => {
    const id = `msg_${randomBytes(8).toString("hex")}`;
    const ts = String(Math.floor(now / 1000));
    return { body, headers: { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": signStandardWebhook(id, ts, body, secret) } };
  },
};

export const SOURCES: Record<IntakeKind, SourceDef> = {
  sentry: {
    id: "sentry",
    label: "Sentry",
    text: "New error issues open incidents in Awaiting fix.",
    icon: "M3 18 12 4l9 14H3z M12 10v3 M12 15.5h.01",
    labs: false,
    auth: "signature",
    secretFrom: "provider",
    mapping: { key: "projects", label: "Sentry project → repository", placeholder: "shop-backend:ecommerce-api, web:storefront-web" },
    setup: "In Sentry, create an internal integration with this webhook URL and the Issue resource checked. Paste its client secret here.",
    verify: (d, secret) => verifySentry(d.body, d.headers.get("sentry-hook-signature"), secret),
    parse(p) {
      const issue = at(p, "data", "issue");
      const id = str(at(issue, "id"));
      if (at(p, "action") !== "created" || !id) return { ignored: `issue.${str(at(p, "action")) || "unknown"}` };
      const title = str(at(issue, "title"));
      return alert({ fingerprint: `sentry-${id}`, title: title || "Sentry issue", observed: [title, str(at(issue, "culprit"))].filter(Boolean).join(" — "), target: str(at(issue, "project", "slug")), link: link(at(issue, "permalink")), event: "issue.created" });
    },
    newSecret: hexSecret,
    testRequest: (secret) => {
      const body = JSON.stringify({ action: "test", data: {} });
      return { body, headers: { "sentry-hook-signature": hex(secret, body) } };
    },
  },
  pagerduty: {
    id: "pagerduty",
    label: "PagerDuty",
    text: "Triggered and resolved incidents open incidents here.",
    icon: "M6 3v18 M6 4h7a4 4 0 0 1 0 8H6",
    labs: false,
    auth: "signature",
    secretFrom: "provider",
    mapping: { key: "services", label: "PagerDuty service → repository", placeholder: "payments:ecommerce-api" },
    setup: "In PagerDuty, add a generic V3 webhook subscription with this URL for incident.triggered and incident.resolved. Paste the signing secret it shows once.",
    verify: (d, secret) => verifyPagerDuty(d.body, d.headers.get("x-pagerduty-signature"), secret),
    parse(p) {
      const type = str(at(p, "event", "event_type"));
      const data = at(p, "event", "data");
      const id = str(at(data, "id"));
      if (!["incident.resolved", "incident.triggered"].includes(type) || !id) return { ignored: type || "unknown" };
      const title = str(at(data, "title"));
      return alert({ fingerprint: `pd-${id}`, title: title || "PagerDuty incident", observed: title, target: str(at(data, "service", "summary")), link: link(at(data, "html_url")), event: type });
    },
    newSecret: hexSecret,
    testRequest: (secret) => {
      const body = JSON.stringify({ event: { event_type: "pagey.ping", data: {} } });
      return { body, headers: { "x-pagerduty-signature": `v1=${hex(secret, body)}` } };
    },
  },
  incidentio: {
    id: "incidentio",
    label: "incident.io",
    text: "Declared incidents open incidents here, signed with Standard Webhooks.",
    icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8v5 M12 16h.01",
    labs: true,
    ...standard,
    secretFrom: "provider",
    mapping: { key: "types", label: "incident.io incident type → repository", placeholder: "checkout:ecommerce-api" },
    setup: "In incident.io → Settings → Webhooks, add this URL and subscribe to “Public incident created (v2)” and “status updated (v2)”. Paste the signing secret (whsec_…).",
    parse(p) {
      const type = str(at(p, "event_type"));
      if (!/^public_incident\.incident_(created|status_updated)_v2$/.test(type)) return { ignored: type || "unknown" };
      const body = at(p, type);
      const inc = at(body, "incident") ?? body;
      const id = str(at(inc, "id"));
      if (!id) return { ignored: type };
      const name = str(at(inc, "name"));
      return alert({ fingerprint: `incidentio-${id}`, title: name, observed: str(at(inc, "summary")) || name, target: str(at(inc, "incident_type", "name")), link: link(at(inc, "permalink")), event: type });
    },
  },
  linear: {
    id: "linear",
    label: "Linear",
    text: "Issues labelled “incident” open incidents here.",
    icon: "M4 13l7 7 M4 9l11 11 M5 6l13 13 M8 4l12 12",
    labs: true,
    auth: "signature",
    secretFrom: "provider",
    mapping: { key: "teams", label: "Linear team key → repository", placeholder: "PAY:ecommerce-api" },
    setup: "In Linear → Settings → API → Webhooks, add this URL for Issues. Paste the signing secret. Label an issue “incident” to send it.",
    verify: (d, secret, now) => verifyLinear(d.body, d.headers.get("linear-signature"), secret, now),
    parse(p) {
      const type = str(at(p, "type"));
      const action = str(at(p, "action"));
      const data = at(p, "data");
      const labelled = list(at(data, "labels")).some((l) => str(at(l, "name")).toLowerCase() === "incident");
      const id = str(at(data, "id"));
      if (type !== "Issue" || !["create", "update"].includes(action) || !labelled || !id) return { ignored: `${type || "unknown"}.${action || "unknown"}` };
      const title = str(at(data, "title"));
      return alert({ fingerprint: `linear-${id}`, title, observed: str(at(data, "description")) || title, target: str(at(data, "team", "key")), link: link(at(data, "url") ?? at(p, "url")), event: `Issue.${action}` });
    },
    newSecret: hexSecret,
    testRequest: (secret, now) => {
      const body = JSON.stringify({ type: "Ping", action: "test", webhookTimestamp: now });
      return { body, headers: { "linear-signature": hex(secret, body) } };
    },
  },
  rootly: {
    id: "rootly",
    label: "Rootly",
    text: "Created and resolved incidents open incidents here.",
    icon: "M12 21V9 M12 9c0-3 2-5 5-5 M12 13c0-3-2-5-5-5",
    labs: true,
    ...tokenAuth,
    mapping: { key: "services", label: "Rootly service → repository", placeholder: "checkout:ecommerce-api" },
    setup: "In Rootly → Configuration → Webhooks, add this URL for incident.created and incident.resolved, with the header Authorization: Bearer <token>.",
    parse(p) {
      const type = str(at(p, "event", "type"));
      const data = at(p, "data");
      const id = str(at(data, "id"));
      if (!["incident.created", "incident.mitigated", "incident.resolved"].includes(type) || !id) return { ignored: type || "unknown" };
      const title = str(at(data, "title"));
      return alert({ fingerprint: `rootly-${id}`, title, observed: str(at(data, "summary")) || title, target: str(at(list(at(data, "services"))[0], "name")), link: link(at(data, "url")), event: type });
    },
    testRequest: tokenTest({ event: { type: "aftershock.ping" } }),
  },
  opsgenie: {
    id: "opsgenie",
    label: "Opsgenie",
    text: "Created and closed alerts open incidents here. Moving off Opsgenie? Your history still counts.",
    icon: "M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z",
    labs: true,
    ...tokenAuth,
    mapping: { key: "entities", label: "Opsgenie entity → repository", placeholder: "checkout:ecommerce-api" },
    setup: "In Opsgenie → Integrations → Webhook, use this URL, turn on Create and Close alert actions, and add the header Authorization: Bearer <token>.",
    parse(p) {
      const action = str(at(p, "action"));
      const a = at(p, "alert");
      const id = str(at(a, "alertId"));
      if (!["Create", "Close"].includes(action) || !id) return { ignored: action || "unknown" };
      const message = str(at(a, "message"));
      return alert({ fingerprint: `opsgenie-${id}`, title: message, observed: str(at(a, "description")) || message, target: str(at(a, "entity")) || str(list(at(a, "tags"))[0]), event: `alert.${action}` });
    },
    testRequest: tokenTest({ action: "Ping" }),
  },
  datadog: {
    id: "datadog",
    label: "Datadog",
    text: "Triggered monitors open incidents here.",
    icon: "M4 18l4-6 4 3 4-8 4 5 M4 21h16",
    labs: true,
    ...tokenAuth,
    mapping: { key: "services", label: "Datadog service tag → repository", placeholder: "checkout:ecommerce-api" },
    setup: 'In Datadog → Integrations → Webhooks, add this URL with the header Authorization: Bearer <token> and the payload {"id":"$AGGREG_KEY","title":"$EVENT_TITLE","message":"$EVENT_MSG","transition":"$ALERT_TRANSITION","link":"$LINK","tags":"$TAGS"}. Mention @webhook-aftershock in a monitor.',
    parse(p) {
      const id = str(at(p, "id"));
      const transition = str(at(p, "transition"));
      if (!id || (transition && !["Triggered", "Re-Triggered"].includes(transition))) return { ignored: transition || "unknown" };
      const service = str(at(p, "tags")).split(",").map((t) => t.trim()).find((t) => t.startsWith("service:"))?.slice(8) ?? "";
      const title = str(at(p, "title"));
      return alert({ fingerprint: `datadog-${id}`, title, observed: str(at(p, "message")) || title, target: service, link: link(at(p, "link")), event: `monitor.${transition || "Triggered"}` });
    },
    testRequest: tokenTest({ transition: "Ping" }),
  },
  jira: {
    id: "jira",
    label: "Jira",
    text: "Bugs and incidents created in Jira open incidents here.",
    icon: "M12 3l9 9-9 9-9-9z M12 8l4 4-4 4-4-4z",
    labs: true,
    ...tokenAuth,
    mapping: { key: "projects", label: "Jira project key → repository", placeholder: "SHOP:ecommerce-api" },
    setup: "In Jira → Automation, add a rule “Issue created” → “Send web request” to this URL with the header Authorization: Bearer <token> and the issue data as the body. Only issue types Bug and Incident, or the label incident, are taken.",
    parse(p) {
      const event = str(at(p, "webhookEvent"));
      const issue = at(p, "issue");
      const f = at(issue, "fields");
      const id = str(at(issue, "id"));
      const kind = str(at(f, "issuetype", "name")).toLowerCase();
      const labelled = list(at(f, "labels")).some((l) => str(l).toLowerCase() === "incident");
      if (!["jira:issue_created", "jira:issue_updated"].includes(event) || !id || !(kind === "bug" || kind === "incident" || labelled)) return { ignored: event || "unknown" };
      const key = str(at(issue, "key"));
      const summary = str(at(f, "summary"));
      let browse: string | undefined;
      try {
        browse = key ? link(`${new URL(str(at(issue, "self"))).origin}/browse/${key}`) : undefined;
      } catch {
        browse = undefined;
      }
      return alert({ fingerprint: `jira-${id}`, title: key ? `${key}: ${summary}` : summary, observed: adf(at(f, "description")).trim() || summary, target: str(at(f, "project", "key")), link: browse, event });
    },
    testRequest: tokenTest({ webhookEvent: "aftershock:ping" }),
  },
  webhook: {
    id: "webhook",
    label: "Generic webhook",
    text: "Anything that can send a signed JSON webhook (Standard Webhooks).",
    icon: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    labs: true,
    ...standard,
    secretFrom: "aftershock",
    mapping: { key: "services", label: "Service → repository", placeholder: "billing:ecommerce-api" },
    setup: 'Send {"type":"incident.created","data":{"id","title","description","service","url"}}, signed with Standard Webhooks (webhook-id, webhook-timestamp, webhook-signature) using the secret generated here.',
    parse(p) {
      const type = str(at(p, "type"));
      const data = at(p, "data");
      const id = str(at(data, "id"));
      if (!type.startsWith("incident.") || !id) return { ignored: type || "unknown" };
      const title = str(at(data, "title"));
      return alert({ fingerprint: `webhook-${id}`, title, observed: str(at(data, "description")) || title, target: str(at(data, "service")) || str(at(data, "repository")), link: link(at(data, "url")), event: type });
    },
    testRequest: (secret, now) => standard.testRequest(secret, now, JSON.stringify({ type: "aftershock.ping" })),
  },
};

export const SOURCE_IDS = Object.keys(SOURCES) as IntakeKind[];

export function isSource(id: string): id is IntakeKind {
  return Object.prototype.hasOwnProperty.call(SOURCES, id);
}
