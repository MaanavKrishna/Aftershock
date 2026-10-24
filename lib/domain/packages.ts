/**
 * The monorepo package a fix belongs to: for each changed file, the package with the longest
 * path containing it; the package with the most changed files wins. Null means the repository root.
 */
export function resolvePackage<P extends { path: string }>(changedFiles: string[], packages: P[]): P | null {
  const votes = new Map<P, number>();
  for (const f of changedFiles) {
    const best = packages.filter((p) => f.startsWith(`${p.path.replace(/\/+$/, "")}/`)).sort((a, b) => b.path.length - a.path.length)[0];
    if (best) votes.set(best, (votes.get(best) ?? 0) + 1);
  }
  let winner: P | null = null;
  for (const [p, n] of votes) if (!winner || n > votes.get(winner)! || (n === votes.get(winner)! && p.path.length > winner.path.length)) winner = p;
  return winner;
}
