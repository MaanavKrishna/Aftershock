/** "absent": the code under test does not exist yet at that commit (the test cannot load), so the bug cannot either. */
export type Probe = "pass" | "fail" | "error" | "absent";
export type EpicenterResult = { sha: string; subject: string; testedCommits: number; arrivedWithCode?: boolean } | { unavailable: string };

/**
 * chain: first-parent ancestors of the commit before the fix, newest first. The proven test fails at chain[0].
 * Find the oldest consecutive failing commit — where the bug was introduced — using at most `maxRuns` probes:
 * gallop back until the test passes, then binary-search the boundary.
 */
export async function findEpicenter(chain: { sha: string; subject: string }[], probe: (sha: string) => Promise<Probe>, maxRuns = 12, opts: { reachedRoot?: boolean } = {}): Promise<EpicenterResult> {
  if (chain.length === 0) return { unavailable: "No history to search." };
  let runs = 0;
  const test = async (i: number) => {
    runs++;
    return probe(chain[i].sha);
  };
  let lo = 0; // known failing
  let hi = -1; // known passing (or the code is absent)
  let hiAbsent = false;
  for (let step = 1; ; step *= 2) {
    const i = Math.min(lo + step, chain.length - 1);
    if (i === lo) break;
    if (runs >= maxRuns) return { unavailable: `Stopped after ${maxRuns} runs without finding a passing ancestor.` };
    const r = await test(i);
    if (r === "error") return { unavailable: `The test could not run on ${chain[i].sha.slice(0, 7)} (old dependencies). Epicenter search stopped.` };
    if (r === "pass" || r === "absent") {
      hi = i;
      hiAbsent = r === "absent";
      break;
    }
    lo = i;
    if (i === chain.length - 1) break;
  }
  if (hi === -1) {
    return { unavailable: opts.reachedRoot ? "The test fails on every commit back to the repository's first, so no commit shows where the bug started." : `The bug is older than the ${chain.length} commits searched.` };
  }
  while (hi - lo > 1) {
    if (runs >= maxRuns) return { unavailable: `Narrowed to ${hi - lo} commits after ${maxRuns} runs.` };
    const mid = Math.floor((lo + hi) / 2);
    const r = await test(mid);
    if (r === "error") return { unavailable: `The test could not run on ${chain[mid].sha.slice(0, 7)}. Epicenter search stopped.` };
    if (r === "fail") lo = mid;
    else {
      hi = mid;
      hiAbsent = r === "absent";
    }
  }
  return { sha: chain[lo].sha, subject: chain[lo].subject, testedCommits: runs, ...(hiAbsent ? { arrivedWithCode: true } : {}) };
}

export function prFromSubject(subject: string): number | undefined {
  const m = subject.match(/^Merge pull request #(\d+)/) ?? subject.match(/\(#(\d+)\)\s*$/);
  return m ? Number(m[1]) : undefined;
}

/** Nightly results, oldest first. */
export function healthFrom(nights: boolean[]): "healthy" | "flaky" | "failing" {
  if (nights.length === 0) return "healthy";
  if (!nights[nights.length - 1]) return "failing";
  return nights.includes(false) ? "flaky" : "healthy";
}
