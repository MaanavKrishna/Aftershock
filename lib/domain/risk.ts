export type RiskLevel = "low" | "medium" | "high";
export type Risk = { level: RiskLevel; score: number; incidents: string[]; reasons: string[] };
type Past = { key: string; status: string; watchedFiles: string[] };

const list = (keys: string[]) => (keys.length <= 1 ? keys.join("") : `${keys.slice(0, -1).join(", ")} and ${keys[keys.length - 1]}`);

/**
 * How likely a change is to bring back a past incident, from the code it touches. A proven incident's
 * files weigh 3, an unproven or still-open one's 2; a file behind several incidents compounds. Shown on
 * every check, including ones where no test runs.
 */
export function riskOf(changed: string[], incidents: Past[]): Risk {
  const files = [...new Set(changed)];
  const hits = files
    .map((f) => {
      const behind = incidents.filter((i) => i.watchedFiles.includes(f));
      const weight = behind.reduce((n, i) => n + (i.status === "proven" ? 3 : 2), 0);
      return { f, behind: behind.map((i) => i.key), weight };
    })
    .filter((h) => h.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.f.localeCompare(b.f));
  const score = hits.reduce((n, h) => n + h.weight, 0);
  const keys = [...new Set(hits.flatMap((h) => h.behind))];
  const level: RiskLevel = score === 0 ? "low" : score >= 5 || hits.some((h) => h.behind.length > 1) ? "high" : "medium";
  return { level, score, incidents: keys, reasons: hits.slice(0, 5).map((h) => `Touches ${h.f}, the code behind ${list(h.behind)}`) };
}
