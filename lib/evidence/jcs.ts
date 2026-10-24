/**
 * JSON Canonicalization Scheme (RFC 8785): object keys sorted by UTF-16 code units, no whitespace,
 * ECMAScript number and string serialisation. The same document always yields the same bytes to sign.
 */
export function canonicalize(v: unknown): string {
  if (v === null || typeof v === "boolean") return JSON.stringify(v);
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("JCS: numbers must be finite");
    return JSON.stringify(v);
  }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : canonicalize(x))).join(",")}]`;
  if (typeof v === "object") {
    if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) throw new Error("JCS: only plain objects can be signed");
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(o[k])}`).join(",")}}`;
  }
  throw new Error(`JCS: cannot sign a ${typeof v}`);
}
