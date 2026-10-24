import { readFile } from "node:fs/promises";
import path from "node:path";
import { Marked } from "marked";

export type DocPage = { slug: string; file: string; title: string; group: "Start" | "Guides" | "Reference" };

/** The docs site is rendered from the repository's own docs/*.md, so there is one source of truth. */
export const DOCS: DocPage[] = [
  { slug: "", file: "quickstart.md", title: "Quickstart", group: "Start" },
  { slug: "concepts", file: "concepts.md", title: "Core concepts", group: "Start" },
  { slug: "setup", file: "setup.md", title: "Setup on Vercel", group: "Guides" },
  { slug: "self-hosting", file: "self-hosting.md", title: "Self-hosting with Docker", group: "Guides" },
  { slug: "integrations", file: "integrations.md", title: "Alerts and tickets", group: "Guides" },
  { slug: "notifications", file: "notifications.md", title: "Notifications", group: "Guides" },
  { slug: "languages", file: "languages.md", title: "Languages and monorepos", group: "Guides" },
  { slug: "still-guarding", file: "still-guarding.md", title: "Still guarding and strength", group: "Guides" },
  { slug: "agents", file: "agents.md", title: "Coding agents", group: "Guides" },
  { slug: "evidence", file: "evidence.md", title: "Audit evidence", group: "Guides" },
  { slug: "api", file: "api.md", title: "API, CLI and Actions", group: "Reference" },
  { slug: "operations", file: "operations.md", title: "Operations", group: "Reference" },
  { slug: "architecture", file: "architecture.md", title: "Architecture", group: "Reference" },
  { slug: "threat-model", file: "threat-model.md", title: "Threat model", group: "Reference" },
];

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");
const byFile = new Map(DOCS.map((d) => [d.file, d]));
const slugify = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type Rendered = { html: string; headings: { id: string; text: string }[] };

/** Markdown from our own repository (trusted), with heading anchors and links between docs rewritten to the site. */
export async function renderDoc(page: DocPage): Promise<Rendered> {
  const md = await readFile(path.join(process.cwd(), "docs", page.file), "utf8");
  const headings: { id: string; text: string }[] = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        if (depth === 1) return "";
        const id = slugify(text);
        if (depth === 2) headings.push({ id, text: text.replace(/<[^>]+>/g, "") });
        return `<h${depth} id="${id}"><a href="#${id}" class="anchor" aria-hidden="true" tabindex="-1">#</a>${text}</h${depth}>`;
      },
      link({ href, tokens }) {
        const text = this.parser.parseInline(tokens);
        const [file, hash] = href.split("#");
        const doc = byFile.get(file.replace(/^\.\//, ""));
        if (doc) return `<a href="${docHref(doc.slug)}${hash ? `#${hash}` : ""}">${text}</a>`;
        if (/^\.\.\//.test(href)) return `<a href="https://github.com/MaanavKrishna/Aftershock/blob/main/${href.replace(/^\.\.\//, "")}" rel="noopener">${text}</a>`;
        if (/^https?:/.test(href)) return `<a href="${href}" rel="noopener">${text}</a>`;
        return `<a href="${href}">${text}</a>`;
      },
      code({ text, lang }) {
        const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<pre tabindex="0"><code${lang ? ` class="language-${lang.replace(/[^\w-]/g, "")}"` : ""}>${esc}</code></pre>`;
      },
      table(token) {
        const head = token.header.map((c) => `<th scope="col">${this.parser.parseInline(c.tokens)}</th>`).join("");
        const body = token.rows.map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`).join("");
        return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
      },
    },
  });
  const html = await marked.parse(md);
  return { html, headings };
}
