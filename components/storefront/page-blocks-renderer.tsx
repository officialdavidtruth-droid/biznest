import Link from "next/link";
import type { PageBlock } from "@/lib/page-blocks";
import { isBlockEmpty } from "@/lib/page-blocks";

export type PageCatalogItem = {
  id: string;
  kind: "product" | "service";
  name: string;
  price: number;
  currency: string;
  image: string | null;
};

type Theme = { bg: string; ink: string; accent: string; card?: string; radius?: string; headlineFont?: string };

const money = (n: number, c = "NGN") => `${c === "NGN" ? "₦" : c + " "}${Number(n).toLocaleString()}`;
const SPACER = { sm: 16, md: 40, lg: 80 } as const;

/** Renders a custom page's blocks on the storefront. Empty blocks are skipped. */
export function PageBlocksRenderer({
  blocks,
  theme,
  slug,
  items,
  contact,
}: {
  blocks: PageBlock[];
  theme: Theme;
  slug: string;
  items: PageCatalogItem[];
  contact: { phone?: string | null; email?: string | null; address?: string | null };
}) {
  const radius = theme.radius || "12px";
  return (
    <div className="space-y-6">
      {blocks.filter((b) => !isBlockEmpty(b)).map((b) => {
        switch (b.type) {
          case "heading": {
            const Tag = (`h${b.level}` as "h1" | "h2" | "h3");
            const size = b.level === 1 ? "text-4xl" : b.level === 2 ? "text-2xl" : "text-xl";
            return <Tag key={b.id} className={`${size} font-bold`} style={{ color: theme.accent, fontFamily: theme.headlineFont }}>{b.text}</Tag>;
          }
          case "text":
            return <p key={b.id} className="whitespace-pre-wrap text-base leading-relaxed opacity-90">{b.text}</p>;
          case "image":
            return (
              <figure key={b.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url} alt={b.alt} className="w-full object-cover" style={{ borderRadius: radius }} loading="lazy" />
                {b.caption && <figcaption className="mt-2 text-center text-sm opacity-70">{b.caption}</figcaption>}
              </figure>
            );
          case "button": {
            const href = b.href.startsWith("/") && !b.href.startsWith(`/store/${slug}`) && !b.href.startsWith("//") ? `/store/${slug}${b.href}` : b.href;
            const external = /^https?:/i.test(href);
            return (
              <div key={b.id}>
                <Link
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="inline-block px-6 py-3 text-sm font-semibold"
                  style={{ background: theme.accent, color: theme.bg, borderRadius: radius }}
                >
                  {b.label}
                </Link>
              </div>
            );
          }
          case "quote":
            return (
              <blockquote key={b.id} className="border-l-4 pl-4 text-lg italic" style={{ borderColor: theme.accent }}>
                {b.text}
                {b.author && <footer className="mt-1 text-sm not-italic opacity-70">— {b.author}</footer>}
              </blockquote>
            );
          case "list":
            return (
              <ul key={b.id} className="list-disc space-y-1 pl-6 text-base opacity-90">
                {b.items.filter((i) => i.trim()).map((i, n) => <li key={n}>{i}</li>)}
              </ul>
            );
          case "divider":
            return <hr key={b.id} style={{ borderColor: theme.ink, opacity: 0.15 }} />;
          case "spacer":
            return <div key={b.id} style={{ height: SPACER[b.size] }} aria-hidden />;
          case "products": {
            const list = items
              .filter((i) => b.kind === "all" || (b.kind === "products" ? i.kind === "product" : i.kind === "service"))
              .slice(0, b.limit);
            if (!list.length) return null;
            return (
              <section key={b.id}>
                {b.title && <h2 className="mb-3 text-2xl font-bold" style={{ color: theme.accent, fontFamily: theme.headlineFont }}>{b.title}</h2>}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {list.map((i) => (
                    <Link key={`${i.kind}:${i.id}`} href={`/store/${slug}/${i.kind}/${i.id}`} className="block overflow-hidden" style={{ background: theme.card || "transparent", borderRadius: radius, border: `1px solid ${theme.ink}22` }}>
                      {i.image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={i.image} alt={i.name} className="aspect-square w-full object-cover" loading="lazy" />
                        : <div className="aspect-square w-full" style={{ background: `${theme.accent}22` }} />}
                      <div className="p-3">
                        <div className="text-sm font-semibold">{i.name}</div>
                        <div className="text-sm opacity-80">{money(i.price, i.currency)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          }
          case "contact": {
            const rows = [
              contact.phone && { label: "Phone", value: contact.phone, href: `tel:${contact.phone}` },
              contact.email && { label: "Email", value: contact.email, href: `mailto:${contact.email}` },
              contact.address && { label: "Address", value: contact.address, href: "" },
            ].filter(Boolean) as { label: string; value: string; href: string }[];
            if (!rows.length) return null;
            return (
              <section key={b.id} className="p-5" style={{ background: theme.card || `${theme.accent}11`, borderRadius: radius }}>
                {b.title && <h2 className="mb-3 text-xl font-bold" style={{ color: theme.accent }}>{b.title}</h2>}
                <dl className="space-y-1 text-base">
                  {rows.map((r) => (
                    <div key={r.label} className="flex gap-2">
                      <dt className="w-20 opacity-70">{r.label}</dt>
                      <dd>{r.href ? <a href={r.href} className="underline">{r.value}</a> : r.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          }
        }
      })}
    </div>
  );
}
