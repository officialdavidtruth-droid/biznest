/**
 * A small Markdown parser for blog posts. It produces a typed tree, never an HTML string, and the storefront
 * renders that tree as React elements, so a post can never inject markup or script into a store page.
 * Supported: # ## ### headings, paragraphs, **bold**, *italic*, `code`, [links](url), ![images](url),
 * - / 1. lists, > quotes, --- rules and ``` code blocks.
 */
export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "img"; src: string; alt: string };

export type Block =
  | { t: "h"; level: 2 | 3 | 4; c: Inline[]; id: string }
  | { t: "p"; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] }
  | { t: "quote"; c: Inline[] }
  | { t: "hr" }
  | { t: "code"; v: string }
  | { t: "img"; src: string; alt: string };

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)[^\s"'<>]*$/i;
const SAFE_IMG = /^(https:\/\/|\/(?!\/))[^\s"'<>()]*$/i;

export const safeHref = (u: string) => (SAFE_LINK.test(u.trim()) ? u.trim() : null);
export const safeSrc = (u: string) => (SAFE_IMG.test(u.trim()) ? u.trim() : null);

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  let buf = "";
  const flush = () => { if (buf) { out.push({ t: "text", v: buf }); buf = ""; } };
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^!\[([^\]]*)\]\(([^)\s]+)\)/))) {
      const s = safeSrc(m[2]);
      if (s) { flush(); out.push({ t: "img", src: s, alt: m[1] }); i += m[0].length; continue; }
    } else if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      const h = safeHref(m[2]);
      if (h) { flush(); out.push({ t: "link", href: h, c: parseInline(m[1]) }); i += m[0].length; continue; }
    } else if ((m = rest.match(/^`([^`]+)`/))) {
      flush(); out.push({ t: "code", v: m[1] }); i += m[0].length; continue;
    } else if ((m = rest.match(/^\*\*([^*]+?)\*\*/)) || (m = rest.match(/^__([^_]+?)__/))) {
      flush(); out.push({ t: "strong", c: parseInline(m[1]) }); i += m[0].length; continue;
    } else if ((m = rest.match(/^\*([^*\s][^*]*?)\*/)) || (m = rest.match(/^_([^_\s][^_]*?)_/))) {
      flush(); out.push({ t: "em", c: parseInline(m[1]) }); i += m[0].length; continue;
    }
    buf += src[i];
    i += 1;
  }
  flush();
  return out;
}

const headingId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push({ t: "code", v: code.join("\n") });
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,4})\s+(.+?)\s*#*$/))) {
      // The post title is the page's <h1>, so # in the body becomes an h2 and the levels below shift with it.
      const level = Math.min(4, Math.max(2, m[1].length + 1)) as 2 | 3 | 4;
      blocks.push({ t: "h", level, c: parseInline(m[2]), id: headingId(m[2]) });
      i++; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ t: "hr" }); i++; continue; }
    if ((m = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
      const s = safeSrc(m[2]);
      if (s) { blocks.push({ t: "img", src: s, alt: m[1] }); i++; continue; }
    }
    if (/^\s*>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ t: "quote", c: parseInline(q.join(" ")) });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(parseInline(lines[i++].replace(/^\s*[-*+]\s+/, "")));
      blocks.push({ t: "ul", items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(parseInline(lines[i++].replace(/^\s*\d+[.)]\s+/, "")));
      blocks.push({ t: "ol", items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i])) para.push(lines[i++].trim());
    blocks.push({ t: "p", c: parseInline(para.join(" ")) });
  }
  return blocks;
}

/** h2/h3 headings for a table of contents. */
export function outline(blocks: Block[]): { id: string; text: string; level: number }[] {
  const text = (c: Inline[]): string => c.map((n) => (n.t === "text" || n.t === "code" ? n.v : n.t === "img" ? "" : text(n.c))).join("");
  return blocks.flatMap((b) => (b.t === "h" && b.level <= 3 && b.id ? [{ id: b.id, text: text(b.c), level: b.level }] : []));
}
