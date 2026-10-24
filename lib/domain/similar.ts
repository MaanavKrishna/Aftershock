const STOP = new Set("a an the and or of in on at to for from with when after before is was were be been it its this that by as not no into than then there their our your error exception failed fails failure".split(" "));
const PATH = /(?:^|[\s"'(:])\/?((?:[\w.-]+\/)+[\w.-]+\.[A-Za-z]{1,5})(?=[\s"':),]|$)/g;

/** Repository-relative file paths mentioned in text (stack traces, Sentry culprits, logs). */
export function extractPaths(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split("\n")) {
    if (/https?:\/\//.test(line) && !/\s(at|in)\s/.test(line)) continue;
    for (const m of line.matchAll(PATH)) {
      const p = m[1].replace(/^(?:app\/)?(?=app\/)/, "").replace(/^\/+/, "");
      if (/^(?:\d+\.)+\d+$/.test(p) || p.includes("://")) continue;
      out.add(p.replace(/^(?:usr|opt|srv|home\/[^/]+)\/.*?\/(?=(app|src|lib)\/)/, ""));
    }
  }
  return [...out];
}

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9_]+/).filter((t) => t.length > 2 && !STOP.has(t)));
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n / (a.size + b.size - n);
};

type Candidate = { id: string; key: string; title: string; observed: string; watchedFiles: string[] };

/**
 * Past incidents that look like this one: shared wording (title and what was observed) plus the files
 * involved. Returns matches scoring at least 0.5, best first. A model may add matches later; it never
 * removes these.
 */
export function similarIncidents(n: { id?: string; title: string; observed: string; files?: string[] }, past: Candidate[], threshold = 0.5): { id: string; key: string; score: number; why: string }[] {
  const words = tokens(`${n.title} ${n.observed}`);
  const files = new Set([...(n.files ?? []), ...extractPaths(`${n.title}\n${n.observed}`)]);
  return past
    .filter((p) => p.id !== n.id)
    .map((p) => {
      const text = jaccard(words, tokens(`${p.title} ${p.observed}`));
      const shared = p.watchedFiles.filter((f) => files.has(f) || [...files].some((x) => x.endsWith(`/${f}`) || f.endsWith(`/${x}`)));
      const fileScore = shared.length ? 1 : 0;
      const score = Math.round((files.size ? 0.55 * text + 0.45 * fileScore : text) * 100) / 100;
      const why = [shared.length ? `same file ${shared[0]}` : "", text >= 0.3 ? "similar error text" : ""].filter(Boolean).join(" and ");
      return { id: p.id, key: p.key, score, why };
    })
    .filter((m) => m.score >= threshold && m.why)
    .sort((a, b) => b.score - a.score);
}
