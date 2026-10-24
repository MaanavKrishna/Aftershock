// Lists (default) or deletes (--yes) every Vercel Sandbox snapshot in the project.
// Usage: VERCEL_TOKEN=... node scripts/sandbox-snapshots.mjs [--yes]
// Create the token at https://vercel.com/account/tokens (scope: the team that owns the project).
const TEAM = process.env.VERCEL_TEAM_ID ?? "team_skC7l2bVDrfOysriZHOXFxuf";
const PROJECT = process.env.VERCEL_PROJECT_ID ?? "prj_Fm2iXIeiJfjxq51lOAPFIDaCatXv";
const token = process.env.VERCEL_TOKEN;
const really = process.argv.includes("--yes");
if (!token) {
  console.error("Set VERCEL_TOKEN (https://vercel.com/account/tokens).");
  process.exit(1);
}

async function api(path, init = {}) {
  const url = new URL(`https://vercel.com/api${path}`);
  url.searchParams.set("teamId", TEAM);
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

const all = [];
let cursor;
do {
  const q = new URLSearchParams({ project: PROJECT, limit: "50", ...(cursor ? { cursor } : {}) });
  const page = await api(`/v2/sandboxes/snapshots?${q}`);
  all.push(...page.snapshots.filter((s) => s.status !== "deleted"));
  cursor = page.pagination?.next ?? undefined;
} while (cursor);

const mb = (b) => Math.round(b / 1e6);
console.log(`${all.length} snapshots, ${mb(all.reduce((n, s) => n + (s.sizeBytes ?? 0), 0))} MB in total.`);
if (!really) {
  console.log("Dry run. Re-run with --yes to delete them.");
  process.exit(0);
}
let done = 0;
for (const s of all) {
  await api(`/v2/sandboxes/snapshots/${s.id}`, { method: "DELETE" });
  done++;
  process.stdout.write(`\rDeleted ${done}/${all.length}`);
}
console.log("\nDone.");
