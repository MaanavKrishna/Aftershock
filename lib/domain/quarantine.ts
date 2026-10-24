const RELEASE_AFTER = 7;

/**
 * nights: oldest first, true = passed. A test that fails some nights but passes the latest is flaky,
 * not broken: it is quarantined so it cannot block pull requests on noise. Seven green nights release it.
 * A test failing on the latest night is a real failure on main and stays active.
 */
export function quarantineDecision(nights: boolean[], current: boolean): { quarantined: boolean; reason: string | null } {
  const latest = nights.at(-1);
  if (current) {
    const recent = nights.slice(-RELEASE_AFTER);
    if (recent.length >= RELEASE_AFTER && recent.every(Boolean)) return { quarantined: false, reason: null };
    return { quarantined: true, reason: reasonFor(nights.slice(-RELEASE_AFTER)) };
  }
  // Same window as release, so failures from before a release cannot quarantine it again.
  const recent = nights.slice(-RELEASE_AFTER);
  if (latest === true && recent.filter((x) => !x).length >= 2) return { quarantined: true, reason: reasonFor(recent) };
  return { quarantined: false, reason: null };
}

function reasonFor(nights: boolean[]) {
  return `Flaky on main: failed ${nights.filter((x) => !x).length} of the last ${nights.length} nights`;
}
