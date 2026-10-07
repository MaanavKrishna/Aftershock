import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { incidentKey } from "@/lib/domain/ids";

export type Alert = { fingerprint: string; title: string; observed: string; target: string; link?: string; event: string };

/** "a:b, c:d" → { a: "b", c: "d" } */
export function parseMapping(raw: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (raw ?? "")
      .split(/[,·\n]/)
      .map((p) => p.split(/:|→/).map((x) => x.trim()))
      .filter((p) => p.length === 2 && p[0] && p[1]),
  );
}

export async function integrationFor(login: string, kind: "sentry" | "pagerduty") {
  const db = await getDb();
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.login, login));
  if (!ws) return null;
  const [integ] = await db.select().from(s.integrations).where(and(eq(s.integrations.workspaceId, ws.id), eq(s.integrations.kind, kind)));
  return { ws, integ: integ ?? null, secret: integ?.secretCiphertext && integ.enabled ? decrypt(integ.secretCiphertext) : "" };
}

export async function logDelivery(workspaceId: string, kind: string, event: string, detail: string, ok: boolean) {
  const db = await getDb();
  await db.insert(s.deliveries).values({ workspaceId, kind, event, detail: detail.slice(0, 300), ok });
}

/** Opens an Awaiting fix incident for an alert, once per fingerprint. */
export async function intakeAlert(ws: typeof s.workspaces.$inferSelect, source: "sentry" | "pagerduty", mapping: Record<string, string>, a: Alert): Promise<{ created: boolean; key?: string }> {
  const db = await getDb();
  const [dupe] = await db.select().from(s.incidents).where(and(eq(s.incidents.workspaceId, ws.id), eq(s.incidents.fingerprint, a.fingerprint)));
  if (dupe) return { created: false, key: incidentKey(ws.incidentPrefix, dupe.number) };
  const repos = await db.select().from(s.repositories).where(eq(s.repositories.workspaceId, ws.id));
  const repoName = mapping[a.target] ?? a.target;
  const repo = repos.find((r) => r.name === repoName) ?? (repos.length === 1 ? repos[0] : undefined);
  const { scoped } = await import("@/lib/db/queries/scope");
  const number = await scoped(ws.id).nextIncidentNumber();
  const [inc] = await db
    .insert(s.incidents)
    .values({ workspaceId: ws.id, repoId: repo?.id ?? null, number, title: a.title.slice(0, 200), observed: a.observed.slice(0, 4000), source, sourceRef: a.link ?? null, fingerprint: a.fingerprint, status: "awaiting_fix", statusReason: `Opened from ${source === "sentry" ? "Sentry" : "PagerDuty"}. Time travel starts when a pull request mentioning ${incidentKey(ws.incidentPrefix, number)} merges.` })
    .returning();
  await db.insert(s.activity).values({ workspaceId: ws.id, incidentId: inc.id, title: `${incidentKey(ws.incidentPrefix, number)} opened from ${source === "sentry" ? "Sentry" : "PagerDuty"} alert`, detail: "Awaiting fix", tone: "neutral" });
  return { created: true, key: incidentKey(ws.incidentPrefix, number) };
}
