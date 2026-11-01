import type { CSSProperties } from "react";
import Link from "next/link";
import { isSafeImageUrl, safeHref } from "@/lib/builder-safe";
import type { PageBlock } from "@/lib/storefront/page-blocks";
import type { BlockCatalog, CatalogCard } from "@/lib/storefront/page-block-catalog";

export type BlockTokens = { text: string; accent: string; primary: string; line: string; radius: number | string; headingFont?: string };

/** Site-relative links ("/about") point inside this store; everything else is used as written (after the safety check). */
function resolveHref(href: string, slug: string): string {
  const h = safeHref(href, "");
  if (!h) return "";
  return h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/store/") ? `/store/${slug}${h === "/" ? "" : h}` : h;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en")}`;
  }
}

/** Renders owner-written page blocks. Server component: no hooks, and every URL is re-checked here. */
export function PageBlocks({ blocks, slug, tokens, catalog, wide = false }: { blocks: PageBlock[]; slug: string; tokens: BlockTokens; catalog?: BlockCatalog; wide?: boolean }) {
  const t = tokens;
  const heading = (size: number): CSSProperties => ({ fontFamily: t.headingFont, fontSize: size, lineHeight: 1.2, margin: "28px 0 12px" });
  const grid = (title: string, cards: CatalogCard[], key: string) => (
    <section key={key} style={{ margin: "28px 0" }}>
      {title && <h2 style={{ ...heading(26), margin: "0 0 14px" }}>{title}</h2>}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
        {cards.map((c) => (
          <Link key={c.id} href={`/store/${slug}/product/${encodeURIComponent(c.id)}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
            <div style={{ aspectRatio: "1/1", borderRadius: t.radius, border: `1px solid ${t.line}`, overflow: "hidden", background: `${t.text}0d` }}>
              {c.image && isSafeImageUrl(c.image) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt={c.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 650, lineHeight: 1.3 }}>{c.name}</div>
            <div style={{ marginTop: 2, fontSize: 14 }}>
              <span style={{ fontWeight: 700 }}>{money(c.price, c.currency)}</span>
              {c.compareAt !== null && <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.6, textDecoration: "line-through" }}>{money(c.compareAt, c.currency)}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
  return (
    <div style={{ color: t.text, maxWidth: wide ? undefined : 760 }}>
      {blocks.map((b) => {
        switch (b.type) {
          case "heading":
            return b.level === 3 ? <h3 key={b.id} style={heading(22)}>{b.text}</h3> : <h2 key={b.id} style={heading(30)}>{b.text}</h2>;
          case "text":
            return <p key={b.id} style={{ lineHeight: 1.8, fontSize: 16, whiteSpace: "pre-line", opacity: 0.85, margin: "0 0 16px" }}>{b.text}</p>;
          case "image":
            return isSafeImageUrl(b.url) ? (
              <figure key={b.id} style={{ margin: "20px 0" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url} alt={b.alt} loading="lazy" style={{ width: "100%", height: "auto", borderRadius: t.radius, border: `1px solid ${t.line}` }} />
                {b.caption && <figcaption style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>{b.caption}</figcaption>}
              </figure>
            ) : null;
          case "button": {
            const href = resolveHref(b.href, slug);
            return href ? (
              <p key={b.id} style={{ margin: "20px 0" }}>
                <a href={href} style={{ display: "inline-block", padding: "12px 22px", fontWeight: 700, fontSize: 14, borderRadius: t.radius, background: t.primary, color: "#fff", textDecoration: "none" }}>{b.label}</a>
              </p>
            ) : null;
          }
          case "faq":
            return (
              <div key={b.id} style={{ margin: "20px 0", display: "grid", gap: 10 }}>
                {b.items.map((it, i) => (
                  <details key={i} style={{ border: `1px solid ${t.line}`, borderRadius: t.radius, padding: "12px 16px" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 700 }}>{it.q}</summary>
                    <p style={{ lineHeight: 1.7, whiteSpace: "pre-line", opacity: 0.85, margin: "10px 0 0" }}>{it.a}</p>
                  </details>
                ))}
              </div>
            );
          case "gallery":
            return (
              <div key={b.id} style={{ margin: "20px 0", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
                {b.images.filter((im) => isSafeImageUrl(im.url)).map((im, i) => (
                  <figure key={i} style={{ margin: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt={im.caption} loading="lazy" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: t.radius, border: `1px solid ${t.line}` }} />
                    {im.caption && <figcaption style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{im.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            );
          case "products":
          case "collection": {
            // Nothing to show (products removed, unpublished or the lookup failed): leave the section out entirely.
            const cards = catalog?.[b.id] ?? [];
            return cards.length ? grid(b.title, cards, b.id) : null;
          }
          case "divider":
            return <hr key={b.id} style={{ border: 0, borderTop: `1px solid ${t.line}`, margin: "28px 0" }} />;
        }
      })}
    </div>
  );
}
