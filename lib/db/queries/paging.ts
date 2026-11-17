/**
 * Keyset paging for list queries. A cursor is opaque to callers: base64url of `[kind, sortKey, id]`,
 * where `sortKey` is the last row's sort column (an incident number, or a timestamp as Postgres
 * text so microseconds survive) and `id` breaks ties. Pages never skip or repeat rows while rows
 * are added, because each page continues strictly after the last row it returned.
 */
export type Page<T> = { rows: T[]; nextCursor: string | null };

export type CursorKind = "incident" | "check" | "memory" | "audit";

export const MAX_PAGE = 200;

/** Timestamp sort keys: UTC with microseconds, as written by `tsKey` in scope.ts. */
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
/** Largest value of a Postgres `integer` column (incident numbers). */
const MAX_INT = 2 ** 31 - 1;

/** The right shape and a real instant: Postgres would reject month 13 or 30 February with an error, not an empty page. */
function realTimestamp(key: string): boolean {
  if (!TS.test(key)) return false;
  const t = Date.parse(key.slice(0, 19) + "Z");
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 19) === key.slice(0, 19);
}

export function encodeCursor(kind: CursorKind, key: string | number, id: string): string {
  return Buffer.from(JSON.stringify([kind, key, id])).toString("base64url");
}

/** The cursor's sort key and id, or null when it is missing, malformed or from another list (callers start over). */
export function decodeCursor<K extends string | number>(kind: CursorKind, cursor: string | null | undefined, keyType: "number" | "string"): { key: K; id: string } | null {
  if (!cursor) return null;
  try {
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (!Array.isArray(v) || v.length !== 3 || v[0] !== kind || typeof v[2] !== "string" || typeof v[1] !== keyType) return null;
    if (keyType === "number" && !(Number.isInteger(v[1]) && (v[1] as number) >= 1 && (v[1] as number) <= MAX_INT)) return null;
    if (keyType === "string" && !realTimestamp(v[1] as string)) return null;
    return { key: v[1] as K, id: v[2] };
  } catch {
    return null;
  }
}

/** Whole numbers from 1 to MAX_PAGE; anything else falls back to the default or the nearest bound. */
export function clampLimit(limit: number | undefined, fallback: number): number {
  const n = Number.isFinite(limit) ? Math.floor(limit as number) : fallback;
  return Math.max(1, Math.min(MAX_PAGE, n));
}

/** Fetch `limit + 1` rows, then call this: it trims the extra row and builds the next cursor from the last kept row. */
export function toPage<T>(rows: T[], limit: number, cursorOf: (row: T) => string): Page<T> {
  const more = rows.length > limit;
  const kept = more ? rows.slice(0, limit) : rows;
  return { rows: kept, nextCursor: more && kept.length ? cursorOf(kept[kept.length - 1]) : null };
}
