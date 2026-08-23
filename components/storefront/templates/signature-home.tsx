import React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { TemplateTheme } from "@/lib/template-themes";

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type StoreLike = any;
type CategoryNode = any;
type Review = any;

type Props = {
  store: StoreLike; slug: string; catalogItems: CatalogItem[]; navCategories: CategoryNode[];
  goodReviews: Review[]; avgRating: number | null; completedOrders: number; social: Record<string, string>;
  theme: TemplateTheme & { signatureMode?: string };
};

const MODES = {
  electra: { label: "Technology, refined.", cta: "Shop the latest", dark: false },
  atelier: { label: "The new season", cta: "Explore collection", dark: false },
  kinetic: { label: "New drop / limited", cta: "Shop the drop", dark: true },
  bloom: { label: "Rituals for every day", cta: "Shop beauty", dark: false },
  haven: { label: "Objects for better living", cta: "Explore the home", dark: false },
  harvest: { label: "Fresh to your door", cta: "Shop groceries", dark: false },
  maison: { label: "Stay somewhere beautiful", cta: "Find your room", dark: true },
  ember: { label: "Good food. Good nights.", cta: "View the menu", dark: true },
  muse: { label: "Your time, beautifully spent", cta: "Book an appointment", dark: false },
  frame: { label: "Stories worth remembering", cta: "View the portfolio", dark: false },
  north: { label: "Strategy with substance", cta: "Start a project", dark: true },
  pure: { label: "A cleaner space starts here", cta: "Book a clean", dark: false },
  forge: { label: "Built for the long run", cta: "Request a quote", dark: true },
} as const;

function money(item: CatalogItem) { return `${item.currency} ${item.price.toLocaleString()}`; }
function imgStyle(url: string | null, fallback: string) { return url ? { backgroundImage: `url(${url})` } : { background: fallback }; }

export function SignatureStorefront(props: Props) {
  const { store, slug, catalogItems, navCategories, goodReviews, avgRating, completedOrders, theme } = props;
  const mode = (theme.signatureMode || "electra") as keyof typeof MODES;
  const meta = MODES[mode] || MODES.electra;
  const featured = catalogItems.slice(0, 6);
  const services = catalogItems.filter((x) => x.kind === "service").slice(0, 4);
  const hero = store.bannerUrl || store.template?.previewUrl || null;
  const primary = theme.accent;
  const bg = theme.bg;
  const ink = theme.ink;
  const muted = theme.muted || `${ink}99`;
  const dark = meta.dark;

  const nav = (
    <>
      <header style={{ position: "sticky", top: 0, zIndex: 30, backdropFilter: "blur(18px)", background: `${bg}eF`, borderBottom: `1px solid ${theme.border || ink + "18"}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <a href={`/${slug}`} style={{ color: ink, textDecoration: "none", display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            {store.logoUrl ? <img src={store.logoUrl} alt={store.name} style={{ width: 34, height: 34, objectFit: "contain", borderRadius: theme.radius }} /> : <span style={{ width: 34, height: 34, borderRadius: 12, background: primary, display: "grid", placeItems: "center", color: dark ? "#111" : "#fff", fontWeight: 900 }}>{store.name?.[0]}</span>}
            <strong style={{ fontFamily: theme.headlineFont, fontSize: 17, letterSpacing: mode === "kinetic" ? -0.5 : 0 }}>{store.name}</strong>
          </a>
          <nav style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 13 }}>
            <a href={`/${slug}/catalog`} style={{ color: ink, textDecoration: "none" }}>Explore</a>
            <a href={`/${slug}/search`} style={{ color: ink, textDecoration: "none" }}>Search</a>
            <CartLink storeSlug={slug} accent={primary} onAccent={dark ? "#111" : "#fff"} ink={ink} />
            <AccountLink storeSlug={slug} ink={ink} />
          </nav>
        </div>
      </header>
      <CategoryNav slug={slug} categories={navCategories} accent={primary} ink={ink} bg={bg} border={theme.border || ink + "18"} />
    </>
  );

  const heroBlock = (
    <section style={{ background: dark ? ink : bg, color: dark ? bg : ink, padding: mode === "kinetic" ? "34px 24px 72px" : "24px 24px 70px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ position: "relative", minHeight: mode === "maison" || mode === "frame" ? 590 : 520, borderRadius: mode === "atelier" ? 0 : theme.radius, overflow: "hidden", display: "flex", alignItems: "flex-end", background: hero ? `linear-gradient(90deg, ${dark ? "rgba(0,0,0,.72)" : "rgba(0,0,0,.48)"}, rgba(0,0,0,.05)), url(${hero}) center/cover` : `linear-gradient(135deg, ${primary}, ${theme.accentSoft || primary})`, boxShadow: dark ? "none" : "0 30px 90px rgba(0,0,0,.12)" }}>
          <div style={{ padding: mode === "atelier" ? "70px 56px" : "54px", maxWidth: 720, position: "relative", zIndex: 2 }}>
            <div style={{ textTransform: "uppercase", letterSpacing: 2.4, fontSize: 11, fontWeight: 800, color: dark ? theme.accent : theme.accent }}>{meta.label}</div>
            <h1 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(42px, 7vw, 88px)", lineHeight: .96, letterSpacing: mode === "atelier" ? -3 : -2, margin: "18px 0", fontWeight: 800 }}>{store.name}</h1>
            <p style={{ maxWidth: 520, fontSize: 17, lineHeight: 1.65, color: dark ? `${bg}b8` : `${bg === "#fff" ? ink : ink}b0` }}>{store.business?.description || theme.sub}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <a href={mode === "maison" || mode === "muse" ? `/${slug}/catalog` : `/${slug}/catalog`} style={{ textDecoration: "none", padding: "14px 20px", borderRadius: theme.radius, background: primary, color: dark ? "#111" : "#fff", fontWeight: 800, fontSize: 13 }}>{meta.cta} →</a>
              {avgRating != null && <span style={{ alignSelf: "center", fontSize: 13, color: dark ? `${bg}b8` : muted }}>★ {avgRating.toFixed(1)} · {store.reviews?.length || 0} reviews</span>}
            </div>
          </div>
          {mode === "kinetic" && <div style={{ position: "absolute", top: 28, right: 28, border: `1px solid ${bg}44`, padding: "10px 13px", fontSize: 10, letterSpacing: 1.5 }}>LIMITED RELEASE</div>}
          {mode === "maison" && <div style={{ position: "absolute", right: 28, bottom: 28, background: "#fff", color: "#111", padding: "18px 20px", width: 210, borderRadius: 14 }}><b style={{ display: "block", fontSize: 13 }}>Make your stay memorable</b><span style={{ display: "block", marginTop: 7, fontSize: 11, color: "#666" }}>Rooms, amenities and experiences designed around you.</span></div>}
        </div>
      </div>
    </section>
  );

  const intro = (
    <section style={{ padding: "80px 24px", background: mode === "harvest" ? theme.card : bg, color: ink }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(280px,.9fr)", gap: 70, alignItems: "start" }}>
        <div><div style={{ color: primary, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>Designed around your business</div><h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(30px,4vw,52px)", lineHeight: 1.03, margin: "14px 0" }}>{mode === "maison" ? "A stay that feels considered." : mode === "ember" ? "The menu is the mood." : mode === "frame" ? "Work that speaks before you do." : mode === "forge" ? "From first sketch to final handover." : mode === "pure" ? "More time for what matters." : mode === "north" ? "Clarity for ambitious teams." : "Everything you need, beautifully presented."}</h2></div>
        <div><p style={{ color: muted, lineHeight: 1.8, fontSize: 15 }}>{store.business?.description || "A polished customer experience built around real products, services, trust and easy conversion."}</p><div style={{ display: "flex", gap: 28, marginTop: 28 }}>{[[String(catalogItems.length), "offers"], [avgRating ? avgRating.toFixed(1) : "—", "rating"], [String(completedOrders), "completed"]].map(([n,l]) => <div key={l}><b style={{ display: "block", fontFamily: theme.headlineFont, fontSize: 25 }}>{n}</b><span style={{ color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{l}</span></div>)}</div></div>
      </div>
    </section>
  );

  const catalog = (
    <section style={{ padding: "82px 24px", background: theme.surfaceDark || (mode === "kinetic" ? "#111" : theme.card), color: mode === "kinetic" ? "#fff" : ink }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, marginBottom: 30 }}><div><div style={{ color: primary, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>{mode === "maison" ? "Rooms & stays" : mode === "muse" || mode === "pure" || mode === "forge" ? "Services" : "Featured"}</div><h2 style={{ fontFamily: theme.headlineFont, fontSize: 36, margin: "8px 0 0" }}>{theme.catalogLabel}</h2></div><a href={`/${slug}/catalog`} style={{ color: mode === "kinetic" ? "#fff" : ink, fontSize: 12, textDecoration: "none", borderBottom: `1px solid ${primary}`, paddingBottom: 4 }}>View all →</a></div>
        <div style={{ display: "grid", gridTemplateColumns: mode === "kinetic" ? "repeat(3,1fr)" : "repeat(auto-fit,minmax(220px,1fr))", gap: mode === "atelier" ? 26 : 16 }}>
          {featured.map((item, i) => <Reveal key={item.id} delayMs={i * 50}><a href={`/${slug}/${item.kind}/${item.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}><div style={{ aspectRatio: mode === "atelier" ? "3/4" : mode === "maison" ? "4/3" : "1/1", borderRadius: theme.radius, backgroundSize: "cover", backgroundPosition: "center", ...imgStyle(item.image, `${primary}22`), border: `1px solid ${mode === "kinetic" ? "#ffffff14" : (theme.border || ink + "12")}` }} /><div style={{ padding: "13px 2px" }}><div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: primary }}>{item.categoryName || item.kind}</div><h3 style={{ fontFamily: theme.headlineFont, fontSize: 17, margin: "5px 0" }}>{item.name}</h3><span style={{ fontSize: 12, color: muted }}>{money(item)} {item.isBookable ? "· Bookable" : ""}</span></div></a></Reveal>)}
        </div>
      </div>
    </section>
  );

  const editorial = mode === "frame" || mode === "north" || mode === "forge" || mode === "atelier" ? (
    <section style={{ padding: "80px 24px", background: bg, color: ink }}><div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}><div style={{ minHeight: 430, borderRadius: theme.radius, backgroundSize: "cover", backgroundPosition: "center", ...imgStyle(featured[1]?.image || hero, `linear-gradient(140deg,${primary},${theme.accentSoft || primary})`) }} /><div style={{ padding: "35px 25px", display: "flex", flexDirection: "column", justifyContent: "center" }}><div style={{ color: primary, textTransform: "uppercase", letterSpacing: 2, fontSize: 11, fontWeight: 800 }}>The experience</div><h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(32px,4vw,58px)", lineHeight: 1, margin: "14px 0 20px" }}>{mode === "frame" ? "A portfolio built around stories." : mode === "north" ? "Ideas that move the business forward." : mode === "forge" ? "Craft, coordination and confidence." : "Less noise. More point of view."}</h2><p style={{ color: muted, lineHeight: 1.8, maxWidth: 480 }}>{store.business?.description || theme.sub}</p></div></div></section>
  ) : null;

  const reviews = goodReviews.length ? <section style={{ padding: "70px 24px", background: theme.card, color: ink }}><div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}><div style={{ color: primary, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>Customer love</div><div style={{ fontFamily: theme.headlineFont, fontSize: "clamp(24px,4vw,42px)", lineHeight: 1.2, margin: "16px 0 28px" }}>“{goodReviews[0].comment}”</div><div style={{ fontSize: 12, color: muted }}>— {goodReviews[0].author?.name || "Verified customer"} · ★ {goodReviews[0].rating}</div></div></section> : null;

  return <div className="storefront-root" style={{ background: bg, color: ink, fontFamily: theme.font, minHeight: "100vh" }}>{nav}{heroBlock}{intro}{editorial}{catalog}{reviews}<section style={{ padding: "70px 24px", background: dark ? ink : theme.surfaceDark || ink, color: "#fff" }}><div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}><div style={{ color: primary, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>Ready when you are</div><h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(30px,5vw,58px)", lineHeight: 1, margin: "15px 0 25px" }}>{mode === "maison" ? "Plan your stay." : mode === "ember" ? "Come hungry." : mode === "muse" ? "Make time for yourself." : mode === "pure" ? "Let's make space for clean." : mode === "forge" ? "Let's build it right." : "Make your next move."}</h2><a href={`/${slug}/catalog`} style={{ display: "inline-block", padding: "14px 22px", background: primary, color: "#111", borderRadius: theme.radius, textDecoration: "none", fontWeight: 800, fontSize: 13 }}>{meta.cta} →</a></div></section><footer style={{ padding: "30px 24px", background: dark ? "#080808" : bg, color: dark ? "#aaa" : muted, fontSize: 12 }}><div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}><span>{store.name}</span><span>{store.contactPhone || store.contactEmail || ""}</span><span>Powered by BizNest</span></div></footer></div>;
}
