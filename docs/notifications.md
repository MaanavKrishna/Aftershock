# Notifications

Aftershock can tell Slack, or any service that accepts a signed webhook, when something important happens. Turn on **Notifications** in **Settings → Labs**, then add targets in **Settings → Notifications**. Owners and admins manage targets; a workspace can have up to 10.

## Events

| Event | When |
|---|---|
| `incident.opened` | An incident is recorded, imported from an issue, or opened by an alert |
| `incident.proven` | Time travel proved a test: it fails on the parent commit and passes on the fix |
| `incident.unproven` | Time travel could not prove a test, or stopped |
| `pr.blocked` | A pull request check failed because an incident would recur |
| `epicenter.found` | Epicenter found the commit that introduced the bug |
| `nightly.failing` | A memory test started failing on the default branch |
| `test.quarantined` | A memory test was quarantined as flaky |
| `check.overridden` | Someone overrode a failing check |
| `test.weakened` | A weekly re-proof found a memory test Weak or Drifted ([Still guarding](still-guarding.md)) |

Each target picks its own events. New targets start with every event except `incident.opened` and `check.overridden`.

## Slack

Create an [incoming webhook](https://api.slack.com/messaging/webhooks) for the channel and paste its `https://hooks.slack.com/services/…` URL. Other hosts are refused for Slack targets.

## Signed webhooks

Aftershock POSTs JSON and signs it with [Standard Webhooks](https://www.standardwebhooks.com/). The secret (`whsec_…`) is shown once when you add the target.

```http
POST /your/endpoint
content-type: application/json
webhook-id: 4b0f…
webhook-timestamp: 1790000000
webhook-signature: v1,K5o…

{
  "id": "4b0f…",
  "type": "pr.blocked",
  "createdAt": "2026-10-24T10:00:00.000Z",
  "workspace": "acme",
  "data": { "title": "PR #41 blocked: INC-3 would recur", "detail": "Refactor cart totals", "tone": "fail", "incident": "INC-3", "url": "https://aftershock-mk.vercel.app/incidents/3" }
}
```

To verify: compute HMAC-SHA256 over `${webhook-id}.${webhook-timestamp}.${body}` with the base64-decoded part of the secret after `whsec_`, base64-encode it, and compare with the value after `v1,`. Reject timestamps more than five minutes old. Any Standard Webhooks library does this for you. `id` is stable across retries, so use it to drop duplicates.

## Delivery

- Every activity with an event is written to an outbox in the same place the activity is recorded, then delivered in the background.
- A 2xx answer within 5 seconds counts as delivered. Redirects are not followed.
- Failed attempts are retried after 30 seconds, 2 minutes, 10 minutes and 1 hour, then given up.
- After 10 failed attempts in a row, the target is switched off and the reason is shown. Turning it back on resets the count.
- The daily job sends anything left behind if a delivery run stopped.
- **Send test** posts a sample message straight to the target and shows the HTTP status.
- Delivery history is kept for 30 days.

## Safety

- Target URLs must be `https://` without credentials. Hosts that resolve to private, loopback, link-local, CGNAT, multicast or cloud-metadata addresses are refused. The check runs again on every connection, so DNS can't be re-pointed at an internal address later.
- Slack webhook URLs and signing secrets are stored encrypted (AES-256-GCM). Only a short hint is shown after saving.
