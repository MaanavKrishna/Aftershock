import { ButtonLink } from "@/components/ui/Button";

type Params = Record<string, string | undefined | null>;

/** `path` with the non-empty params as a query string. */
export function withQuery(path: string, params: Params): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * A page size from `?limit=`, honoured only on the in-memory database (local runs and end-to-end tests),
 * so a test can page through a few seeded rows. Everywhere else the list keeps its default size.
 */
export function testLimit(value: string | undefined): number | undefined {
  if (process.env.AFTERSHOCK_DB !== "memory" || !value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Keyset paging links under a list: "First page" once you have moved on, "Next page" while there is more.
 * Plain links, so paging works without JavaScript. `params` are the list's filters, kept on every link.
 */
export function Pager({ path, params, cursor, nextCursor, label = "Pages" }: { path: string; params: Params; cursor?: string | null; nextCursor: string | null; label?: string }) {
  if (!cursor && !nextCursor) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-end gap-2">
      {cursor && (
        <ButtonLink href={withQuery(path, { ...params, cursor: undefined })} variant="secondary" size="sm">
          First page
        </ButtonLink>
      )}
      {nextCursor && (
        <ButtonLink href={withQuery(path, { ...params, cursor: nextCursor })} variant="secondary" size="sm">
          Next page
        </ButtonLink>
      )}
    </nav>
  );
}
