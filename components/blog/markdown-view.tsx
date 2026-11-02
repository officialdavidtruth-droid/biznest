import type { ReactNode } from "react";
import { parseMarkdown, type Block, type Inline } from "@/lib/blog-markdown";

export type MarkdownTokens = { text: string; muted: string; accent: string; line: string; radius: number; headingFont?: string };
const DEFAULT_TOKENS: MarkdownTokens = { text: "#1f2937", muted: "#4b5563", accent: "#16a34a", line: "#e5e7eb", radius: 12 };

function inline(nodes: Inline[], t: MarkdownTokens): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text": return n.v;
      case "strong": return <strong key={i}>{inline(n.c, t)}</strong>;
      case "em": return <em key={i}>{inline(n.c, t)}</em>;
      case "code": return <code key={i} style={{ background: `${t.line}`, padding: "2px 6px", borderRadius: 6, fontSize: "0.9em" }}>{n.v}</code>;
      case "link": {
        const external = /^https?:/i.test(n.href);
        return <a key={i} href={n.href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})} style={{ color: t.accent, textDecoration: "underline", textUnderlineOffset: 3 }}>{inline(n.c, t)}</a>;
      }
      // eslint-disable-next-line @next/next/no-img-element
      case "img": return <img key={i} src={n.src} alt={n.alt} loading="lazy" style={{ maxWidth: "100%", borderRadius: t.radius }} />;
    }
  });
}

/** Renders a post body. Pure React elements built from the parsed tree: nothing in a post can inject HTML or script. */
export function MarkdownView({ markdown, blocks, tokens }: { markdown?: string; blocks?: Block[]; tokens?: Partial<MarkdownTokens> }) {
  const t = { ...DEFAULT_TOKENS, ...tokens };
  const list = blocks ?? parseMarkdown(markdown ?? "");
  const heading = { fontFamily: t.headingFont, lineHeight: 1.25, margin: "1.8em 0 .6em", scrollMarginTop: 96 } as const;
  return (
    <div style={{ color: t.text, fontSize: 17.5, lineHeight: 1.85 }}>
      {list.map((b, i) => {
        switch (b.t) {
          case "h": {
            const H = (`h${b.level}`) as "h2" | "h3" | "h4";
            return <H key={i} id={b.id || undefined} style={{ ...heading, fontSize: b.level === 2 ? 28 : b.level === 3 ? 22 : 18 }}>{inline(b.c, t)}</H>;
          }
          case "p": return <p key={i} style={{ margin: "0 0 1.2em" }}>{inline(b.c, t)}</p>;
          case "ul": return <ul key={i} style={{ margin: "0 0 1.2em", paddingLeft: "1.4em", listStyle: "disc" }}>{b.items.map((it, j) => <li key={j} style={{ margin: ".3em 0" }}>{inline(it, t)}</li>)}</ul>;
          case "ol": return <ol key={i} style={{ margin: "0 0 1.2em", paddingLeft: "1.4em", listStyle: "decimal" }}>{b.items.map((it, j) => <li key={j} style={{ margin: ".3em 0" }}>{inline(it, t)}</li>)}</ol>;
          case "quote": return <blockquote key={i} style={{ margin: "1.6em 0", padding: "4px 0 4px 20px", borderLeft: `4px solid ${t.accent}`, color: t.muted, fontSize: "1.08em", fontStyle: "italic" }}>{inline(b.c, t)}</blockquote>;
          case "hr": return <hr key={i} style={{ border: 0, borderTop: `1px solid ${t.line}`, margin: "2.2em 0" }} />;
          case "code": return <pre key={i} style={{ background: `${t.line}`, padding: 16, borderRadius: t.radius, overflowX: "auto", fontSize: 14, lineHeight: 1.6, margin: "0 0 1.2em" }}><code>{b.v}</code></pre>;
          // eslint-disable-next-line @next/next/no-img-element
          case "img": return <figure key={i} style={{ margin: "1.8em 0" }}><img src={b.src} alt={b.alt} loading="lazy" style={{ width: "100%", borderRadius: t.radius }} />{b.alt && <figcaption style={{ color: t.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>{b.alt}</figcaption>}</figure>;
        }
      })}
    </div>
  );
}
