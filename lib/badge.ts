const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const width = (s: string) => Math.round(s.length * 6.6 + 12);
const COLOR = { pass: "#0369A1", fail: "#C2410C", none: "#57606A" } as const;

/** A flat, shields-style SVG badge. Text is escaped; nothing from the request is echoed. */
export function badgeSvg(label: string, message: string, tone: keyof typeof COLOR): string {
  const lw = width(label);
  const mw = width(message);
  const w = lw + mw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(message)}"><title>${esc(label)}: ${esc(message)}</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#24292F"/><rect x="${lw}" width="${mw}" height="20" fill="${COLOR[tone]}"/><rect width="${w}" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${lw / 2}" y="14">${esc(label)}</text><text x="${lw + mw / 2}" y="14">${esc(message)}</text></g></svg>`;
}
