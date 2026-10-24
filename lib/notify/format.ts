import type { NotifyEvent } from "@/lib/db/schema";
import { signStandardWebhook } from "@/lib/integrations/signatures";

export const NOTIFY_EVENTS: Record<NotifyEvent, string> = {
  "incident.opened": "Incident opened",
  "incident.proven": "Incident proven (test admitted)",
  "incident.unproven": "Incident could not be proven",
  "pr.blocked": "Pull request blocked: an incident would recur",
  "epicenter.found": "Epicenter found",
  "nightly.failing": "Memory test failing on main",
  "test.quarantined": "Memory test quarantined",
  "check.overridden": "Failing check overridden",
  "test.weakened": "Memory test no longer guards (weak or drifted)",
};
export const NOTIFY_EVENT_IDS = Object.keys(NOTIFY_EVENTS) as NotifyEvent[];

export type NotifyPayload = { event: NotifyEvent; title: string; detail: string; tone: string; incident?: string; url?: string; workspace: string; createdAt: string };

/** Five attempts in all: now, then 30s, 2m, 10m and 1h later. */
export const MAX_ATTEMPTS = 5;
const DELAYS = [30_000, 120_000, 600_000, 3_600_000];
export function nextDelayMs(attemptsMade: number): number | null {
  return attemptsMade >= MAX_ATTEMPTS ? null : DELAYS[attemptsMade - 1] ?? null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ICON: Record<string, string> = { pass: ":white_check_mark:", fail: ":x:", pending: ":hourglass_flowing_sand:", neutral: ":large_blue_circle:" };

/** Slack incoming-webhook body (Block Kit) with a plain-text fallback. */
export function slackMessage(p: NotifyPayload) {
  const ref = p.incident && p.url ? `<${p.url}|${esc(p.incident)}>` : p.url ? `<${p.url}|Open in Aftershock>` : "";
  return {
    text: p.title,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `${ICON[p.tone] ?? ICON.neutral} *${esc(p.title)}*${p.detail ? `\n${esc(p.detail)}` : ""}` } },
      { type: "context", elements: [{ type: "mrkdwn", text: [ref, `${esc(NOTIFY_EVENTS[p.event])} · ${esc(p.workspace)}`].filter(Boolean).join(" · ") }] },
    ],
  };
}

/** Outbound webhook: Standard Webhooks headers, so receivers verify it the same way Aftershock verifies inbound ones. */
export function webhookRequest(id: string, p: NotifyPayload, secret: string, now = Date.now()) {
  const body = JSON.stringify({ id, type: p.event, createdAt: p.createdAt, workspace: p.workspace, data: { title: p.title, detail: p.detail, tone: p.tone, incident: p.incident ?? null, url: p.url ?? null } });
  const ts = String(Math.floor(now / 1000));
  return { body, headers: { "content-type": "application/json", "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": signStandardWebhook(id, ts, body, secret) } };
}
