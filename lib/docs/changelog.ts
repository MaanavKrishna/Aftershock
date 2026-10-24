import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

export type Release = { version: string; date: string; html: string; text: string };

/** Releases from CHANGELOG.md ("## [x.y.z] — YYYY-MM-DD" headings), newest first. */
export async function releases(): Promise<Release[]> {
  const md = await readFile(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
  const parts = md.split(/^## /m).slice(1);
  const out: Release[] = [];
  for (const p of parts) {
    const [head, ...rest] = p.split("\n");
    const m = head.match(/\[([^\]]+)\]\s*[—-]\s*(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    const body = rest.join("\n").trim();
    out.push({ version: m[1], date: m[2], html: await marked.parse(body.replace(/^### /gm, "#### ")), text: body.replace(/[#*`[\]]/g, "").slice(0, 600) });
  }
  return out;
}
