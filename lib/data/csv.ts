/**
 * One CSV cell (RFC 4180), safe to open in a spreadsheet: a cell that starts with = + - @ (or a tab or
 * carriage return) would run as a formula, so it gets a leading apostrophe; cells holding quotes,
 * commas or line breaks are quoted, with quotes doubled.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  let v = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** A header row then data rows, CRLF line endings. */
export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
