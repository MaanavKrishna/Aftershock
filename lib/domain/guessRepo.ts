const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The repository a pasted text names, preferring the longest (most specific) match. */
export function guessRepoId(text: string, repos: { id: string; name: string; fullName: string }[]): string | undefined {
  const named = (n: string) => new RegExp(`(^|[^\\w.-])${escape(n)}(?![\\w-])`, "i").test(text);
  return [...repos].sort((a, b) => b.name.length - a.name.length).find((r) => named(r.fullName) || named(r.name))?.id;
}
