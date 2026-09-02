import Link from "next/link";
import { Search } from "lucide-react";
import { AccountLink } from "@/components/storefront/account-link";

type Theme = {
  bg: string; ink: string; card: string; accent: string;
  border?: string; muted?: string; radius: string; font: string; headlineFont: string; surfaceDark?: string;
};

export type HotelStoreLike = { name: string; logoUrl?: string | null; contactPhone?: string | null; contactEmail?: string | null; address?: string | null };

export type HotelSection = "story" | "rooms" | "experience" | "gallery" | "contact";

/**
 * "home" is a valid active value too (the homepage itself isn't one of the
 * five hotel sub-pages) — it just means nothing in the nav gets highlighted.
 */
export type HotelActiveSection = HotelSection | "home";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/**
 * The one hotel-niche header, used by the rooms listing, room detail, and
 * story/experience/gallery/contact pages alike. Previously the room detail
 * page and the other hotel section pages each had their own hand-rolled
 * header with different nav items and CTA copy, so a visitor bounced
 * between two different-looking headers depending on which page they were
 * on. This is the single source of truth for that nav.
 */
export function HotelHeader({ slug, theme, store, active, itemLabelPlural }: { slug: string; theme: Theme; store: HotelStoreLike; active: HotelActiveSection; itemLabelPlural: string }) {
  const ink = theme.ink;
  const accent = theme.accent;
  const border = theme.border || `${ink}1c`;

  const nav: Array<{ key: HotelSection; label: string; href: string }> = [
    { key: "rooms", label: itemLabelPlural, href: `/store/${slug}/hotel/rooms` },
    { key: "experience", label: "Amenities", href: `/store/${slug}/hotel/experience` },
    { key: "gallery", label: "Gallery", href: `/store/${slug}/hotel/gallery` },
    { key: "story", label: "About", href: `/store/${slug}/hotel/story` },
    { key: "contact", label: "Contact", href: `/store/${slug}/hotel/contact` },
  ];

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: `${theme.bg}F5`, backdropFilter: "blur(18px)", borderBottom: `1px solid ${border}` }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", minHeight: 72, padding: "0 28px", display: "flex", alignItems: "center", gap: 28 }}>
        <Link href={`/store/${slug}`} style={{ color: ink, textDecoration: "none", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {store.logoUrl ? <img src={store.logoUrl} alt={store.name} style={{ width: 38, height: 38, objectFit: "contain" }} /> : <span style={{ width: 38, height: 38, display: "grid", placeItems: "center", background: ink, color: theme.bg, fontSize: 12, fontWeight: 800, borderRadius: 8 }}>{initials(store.name)}</span>}
          <span style={{ fontFamily: theme.headlineFont, fontSize: 16, fontWeight: 700, whiteSpace: "nowrap" }}>{store.name}</span>
        </Link>
        <nav style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 24, fontSize: 12.5, fontWeight: 650 }}>
          <Link href={`/store/${slug}`} style={{ color: active === "home" ? accent : ink, textDecoration: "none", opacity: active === "home" ? 1 : 0.75, borderBottom: active === "home" ? `1px solid ${accent}` : "1px solid transparent", paddingBottom: 4 }}>Home</Link>
          {nav.map((item) => (
            <Link key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined} style={{ color: active === item.key ? accent : ink, textDecoration: "none", opacity: active === item.key ? 1 : 0.75, borderBottom: active === item.key ? `1px solid ${accent}` : "1px solid transparent", paddingBottom: 4 }}>{item.label}</Link>
          ))}
          <Link href={`/store/${slug}/search`} aria-label="Search" style={{ color: ink, display: "flex" }}><Search size={16} /></Link>
          <AccountLink storeSlug={slug} ink={ink} />
          <Link href={`/store/${slug}/hotel/rooms`} style={{ padding: "10px 18px", background: accent, color: "#fff", textDecoration: "none", borderRadius: theme.radius, fontWeight: 800, fontSize: 12 }}>Book Now</Link>
        </nav>
      </div>
    </header>
  );
}

export function HotelFooter({ slug, theme, store, itemLabelPlural }: { slug: string; theme: Theme; store: HotelStoreLike; itemLabelPlural: string }) {
  return (
    <footer style={{ padding: "30px 28px", background: theme.surfaceDark || "#171411", color: "rgba(255,255,255,.62)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", fontSize: 11 }}>
        <Link href={`/store/${slug}`} style={{ color: "rgba(255,255,255,.75)", textDecoration: "none" }}>© {new Date().getFullYear()} {store.name}</Link>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Link href={`/store/${slug}/hotel/story`} style={{ color: "inherit", textDecoration: "none" }}>About</Link>
          <Link href={`/store/${slug}/hotel/rooms`} style={{ color: "inherit", textDecoration: "none" }}>{itemLabelPlural}</Link>
          <Link href={`/store/${slug}/hotel/contact`} style={{ color: "inherit", textDecoration: "none" }}>Contact</Link>
        </div>
      </div>
    </footer>
  );
}
