import { decrypt } from "@/lib/crypto";
import { postJson } from "@/lib/net/safeFetch";
import { slackMessage, webhookRequest, type NotifyPayload } from "./format";
import type { Outbound, Target } from "./outbox";

/** Real delivery: SSRF-guarded https POST, 5 s timeout, 2xx counts as delivered. */
export async function sendNotification(target: Target, row: Outbound): Promise<{ ok: boolean; status: string }> {
  const url = decrypt(target.urlCiphertext);
  const payload = row.payload as NotifyPayload;
  const req =
    target.kind === "slack"
      ? { body: JSON.stringify(slackMessage(payload)), headers: {} as Record<string, string> }
      : webhookRequest(row.id, payload, target.secretCiphertext ? decrypt(target.secretCiphertext) : "");
  const { status } = await postJson(url, req.body, req.headers, 5000);
  return { ok: status >= 200 && status < 300, status: String(status) };
}
