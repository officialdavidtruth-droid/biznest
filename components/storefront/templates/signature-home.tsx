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
function imageStyle(url: string | null, fallback: string): React.CSSProperties {
  return url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: fallback };
}

const modeCopy: Record<string, { intro: string; title: string; catalog: string; ready: string }> = {
  electra: { intro: "Engineered for everyday", title: "Power, precision, beautifully packaged.", catalog: "Latest hardware", ready: "Upgrade your everyday." },
  atelier: { intro: "The edit", title: "Considered pieces. A wardrobe with intention.", catalog: "New season", ready: "Find your next piece." },
  kinetic: { intro: "The culture", title: "Built for people who move differently.", catalog: "Latest drop", ready: "Don't miss the drop." },
  bloom: { intro: "Your ritual", title: "Small rituals. Better days.", catalog: "Beauty edit", ready: "Make time for your ritual." },
  haven: { intro: "The home edit", title: "Objects that make a room feel like yours.", catalog: "Curated home", ready: "Bring something beautiful home." },
  harvest: { intro: "Good food, simply", title: "Fresh staples, delivered without the fuss.", catalog: "Fresh picks", ready: "Fill your basket." },
  maison: { intro: "The stay", title: "A slower pace starts here.", catalog: "Rooms & stays", ready: "Your room is waiting." },
  ember: { intro: "At the table", title: "Food, fire and nights worth remembering.", catalog: "Tonight's menu", ready: "Reserve your table." },
  muse: { intro: "The appointment", title: "Expert care, with a little more you in it.", catalog: "Services", ready: "Book your next appointment." },
  frame: { intro: "The work", title: "Images with a reason to exist.", catalog: "Selected work", ready: "Let's create something." },
  north: { intro: "The approach", title: "Clear thinking for businesses ready to move.", catalog: "Capabilities", ready: "Start a conversation." },
  pure: { intro: "The difference", title: "A cleaner space. A lighter day.", catalog: "Cleaning services", ready: "Book your clean." },
  forge: { intro: "The craft", title: "Built carefully. Delivered properly.", catalog: "Our services", ready: "Let's build it right." },
};

export function SignatureStorefront(props: Props) {
  const { store, slug, catalogItems, navCategories, goodReviews, avgRating, completedOrders, theme } = props;
  const mode = (theme.signatureMode || "electra") as keyof typeof MODES;
  const meta = MODES[mode] || MODES.electra;
  const copy = modeCopy[mode] || modeCopy.electra;
  const featured = catalogItems.slice(0, 6);
  const hero = store.bannerUrl || store.template?.previewUrl || null;
  const primary = theme.accent;
  const bg = theme.bg;
  const ink = theme.ink;
  const muted = theme.muted || `${ink}99`;
  const dark = meta.dark;
  const isService = ["muse", "frame", "north", "pure", "forge"].includes(mode);
  const isFood = mode === "ember";
  const isHospitality = mode === "maison";

  const nav = (
    <>
      <header className={`sig-header sig-header-${mode}`} style={{ "--sig-bg": `${bg}F2`, "--sig-ink": ink, "--sig-accent": primary, "--sig-border": theme.border || `${ink}18` } as React.CSSProperties}>
        <div className="sig-header-inner">
          <a href={`/store/${slug}`} className="sig-brand">
            {store.logoUrl ? <img src={store.logoUrl} alt={store.name} /> : <span className="sig-logo">{store.name?.[0]}</span>}
            <strong>{store.name}</strong>
          </a>
          <input type="checkbox" id={`bn-nav-${slug}-signature`} className="bn-nav-toggle" />
          <label htmlFor={`bn-nav-${slug}-signature`} className="bn-hamburger" aria-label="Menu">☰</label>
          <nav className="sig-links">
            <a href={`/store/${slug}/catalog`}>{isHospitality ? "Rooms" : isService ? "Services" : isFood ? "Menu" : "Shop"}</a>
            <a href={`/store/${slug}/search`}>Search</a>
            {store.sellsProducts && <CartLink storeSlug={slug} accent={primary} onAccent={dark ? "#111" : "#fff"} ink={ink} />}
            <AccountLink storeSlug={slug} ink={ink} />
          </nav>
        </div>
      </header>
      <CategoryNav slug={slug} categories={navCategories} accent={primary} ink={ink} bg={bg} border={theme.border || ink + "18"} />
    </>
  );

  const Hero = () => {
    const heroFallback = `linear-gradient(135deg, ${primary}, ${theme.accentSoft || primary})`;
    return (
      <section className={`sig-hero sig-hero-${mode}`} style={{ "--sig-bg": bg, "--sig-ink": ink, "--sig-accent": primary, "--sig-accent-soft": theme.accentSoft || primary, "--sig-hero": hero ? `url(${hero})` : heroFallback } as React.CSSProperties}>
        <div className="sig-hero-media" />
        <div className="sig-hero-content">
          <div className="sig-eyebrow">{meta.label}</div>
          <h1>{store.name}</h1>
          <p>{store.business?.description || theme.sub}</p>
          <div className="sig-actions">
            <a className="sig-primary-btn" href={`/store/${slug}/catalog`}>{meta.cta} <span>↗</span></a>
            {avgRating != null && <span className="sig-rating">★ {avgRating.toFixed(1)} · {store.reviews?.length || 0} reviews</span>}
          </div>
        </div>
        {mode === "kinetic" && <div className="sig-stamp">DROP 01<br/>LIMITED</div>}
        {mode === "electra" && <div className="sig-tech-card"><span>SMART CHOICE</span><b>Designed for<br/>your next move.</b></div>}
        {mode === "maison" && <div className="sig-stay-card"><b>Make your stay memorable</b><span>Rooms, amenities and experiences designed around you.</span></div>}
      </section>
    );
  };

  const Intro = () => (
    <section className={`sig-intro sig-intro-${mode}`} style={{ "--sig-bg": bg, "--sig-ink": ink, "--sig-accent": primary, "--sig-muted": muted } as React.CSSProperties}>
      <div className="sig-intro-grid">
        <div><div className="sig-eyebrow">{copy.intro}</div><h2>{copy.title}</h2></div>
        <div><p>{store.business?.description || theme.sub}</p><div className="sig-stats">
          <div><b>{catalogItems.length}</b><span>{isService ? "services" : isHospitality ? "stays" : "offers"}</span></div>
          <div><b>{avgRating ? avgRating.toFixed(1) : "—"}</b><span>rating</span></div>
          <div><b>{completedOrders}</b><span>completed</span></div>
        </div></div>
      </div>
    </section>
  );

  const Catalog = () => (
    <section className={`sig-catalog sig-catalog-${mode}`} style={{ "--sig-bg": theme.card || bg, "--sig-ink": ink, "--sig-accent": primary, "--sig-muted": muted, "--sig-border": theme.border || `${ink}12` } as React.CSSProperties}>
      <div className="sig-catalog-inner">
        <div className="sig-section-head"><div><div className="sig-eyebrow">{copy.catalog}</div><h2>{theme.catalogLabel}</h2></div><a href={`/store/${slug}/catalog`}>View all ↗</a></div>
        <div className="sig-products">
          {featured.map((item, i) => (
            <Reveal key={item.id} delayMs={i * 50}>
              <a href={`/store/${slug}/${item.kind}/${item.id}`} className="sig-product">
                <div className="sig-product-image" style={imageStyle(item.image, `${primary}22`)}>{(mode === "kinetic" && i === 0) && <span>NEW</span>}{mode === "harvest" && i < 2 && <span>FRESH</span>}</div>
                <div className="sig-product-info"><small>{item.categoryName || item.kind}</small><h3>{item.name}</h3><p>{item.description || ""}</p><strong>{money(item)} {item.isBookable ? "· Bookable" : ""}</strong></div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );

  const Editorial = () => (
    <section className={`sig-editorial sig-editorial-${mode}`} style={{ "--sig-bg": bg, "--sig-ink": ink, "--sig-accent": primary, "--sig-muted": muted } as React.CSSProperties}>
      <div className="sig-editorial-image" style={imageStyle(featured[1]?.image || hero, `linear-gradient(140deg,${primary},${theme.accentSoft || primary})`)} />
      <div className="sig-editorial-copy"><div className="sig-eyebrow">{mode === "frame" ? "Selected story" : mode === "north" ? "How we work" : mode === "forge" ? "Built to last" : mode === "atelier" ? "The point of view" : "The experience"}</div><h2>{mode === "frame" ? "Every frame should say something." : mode === "north" ? "Insight first. Action next." : mode === "forge" ? "Craft, coordination and confidence." : mode === "atelier" ? "Less noise. More point of view." : copy.title}</h2><p>{store.business?.description || theme.sub}</p><a href={`/store/${slug}/catalog`}>Explore more ↗</a></div>
    </section>
  );

  const Reviews = goodReviews.length ? (
    <section className={`sig-review sig-review-${mode}`} style={{ "--sig-bg": dark ? ink : theme.card || bg, "--sig-ink": dark ? bg : ink, "--sig-accent": primary, "--sig-muted": dark ? `${bg}aa` : muted } as React.CSSProperties}>
      <div className="sig-review-inner"><div className="sig-eyebrow">Customer love</div><div className="sig-quote">“{goodReviews[0].comment}”</div><div className="sig-review-author">— {goodReviews[0].author?.name || "Verified customer"} · ★ {goodReviews[0].rating}</div></div>
    </section>
  ) : null;

  return (
    <div className={`signature-root signature-${mode}`} style={{ "--sig-bg": bg, "--sig-ink": ink, "--sig-accent": primary, "--sig-accent-soft": theme.accentSoft || primary, "--sig-muted": muted, "--sig-border": theme.border || `${ink}18`, "--sig-radius": theme.radius || "16px", "--sig-font": theme.font, "--sig-headline": theme.headlineFont } as React.CSSProperties}>
      {nav}<main><Hero /><Intro />{["atelier", "frame", "north", "forge", "maison"].includes(mode) && <Editorial />}<Catalog />{!["electra", "harvest"].includes(mode) && Reviews}<section className={`sig-final sig-final-${mode}`}><div><div className="sig-eyebrow">Ready when you are</div><h2>{copy.ready}</h2><a className="sig-primary-btn" href={`/store/${slug}/catalog`}>{meta.cta} <span>↗</span></a></div></section></main>
      <footer className={`sig-footer sig-footer-${mode}`}><span>{store.name}</span><span>{store.contactPhone || store.contactEmail || ""}</span><span>Powered by BizNest</span></footer>
      <style>{`
        .signature-root{background:var(--sig-bg);color:var(--sig-ink);font-family:var(--sig-font);min-height:100vh;overflow:hidden}
        .signature-root a{text-decoration:none;color:inherit}
        .sig-header{position:sticky;top:0;z-index:30;background:var(--sig-bg);backdrop-filter:blur(18px);border-bottom:1px solid var(--sig-border)}
        .sig-header-inner{max-width:1320px;margin:auto;min-height:78px;padding:0 28px;display:flex;align-items:center;gap:26px}
        .sig-brand{display:flex;align-items:center;gap:11px;min-width:0}
        .sig-brand img,.sig-logo{width:38px;height:38px;object-fit:contain;border-radius:var(--sig-radius)}
        .sig-logo{display:grid;place-items:center;background:var(--sig-accent);color:#fff;font-weight:900}
        .sig-brand strong{font-family:var(--sig-headline);font-size:17px}
        .sig-links{margin-left:auto;display:flex;align-items:center;gap:24px;font-size:12px;font-weight:650}
        .bn-hamburger{display:none;margin-left:auto;font-size:22px;cursor:pointer}
        .sig-hero{position:relative;min-height:650px;display:flex;align-items:flex-end;isolation:isolate;background:var(--sig-bg);overflow:hidden}
        .sig-hero-media{position:absolute;inset:0;background-image:linear-gradient(90deg,rgba(0,0,0,.68),rgba(0,0,0,.08)),var(--sig-hero);background-size:cover;background-position:center;z-index:-1}
        .sig-hero-content{width:min(1320px,100%);margin:auto;padding:100px 28px 80px;color:#fff}
        .sig-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.22em;font-weight:850;color:var(--sig-accent)}
        .sig-hero h1{font-family:var(--sig-headline);font-size:clamp(54px,9vw,118px);line-height:.88;letter-spacing:-.065em;max-width:900px;margin:17px 0 25px;font-weight:650}
        .sig-hero p{max-width:610px;color:rgba(255,255,255,.78);font-size:17px;line-height:1.75;margin:0}
        .sig-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:30px}
        .sig-primary-btn{display:inline-flex;align-items:center;gap:8px;padding:14px 19px;background:var(--sig-accent);color:#111!important;border-radius:var(--sig-radius);font-size:12px;font-weight:850}
        .sig-rating{font-size:12px;color:rgba(255,255,255,.78)}
        .sig-stamp{position:absolute;right:32px;top:120px;width:92px;height:92px;border:1px solid rgba(255,255,255,.65);border-radius:50%;display:grid;place-items:center;text-align:center;font-size:9px;letter-spacing:.12em;color:#fff;transform:rotate(10deg)}
        .sig-tech-card,.sig-stay-card{position:absolute;right:32px;bottom:32px;background:#fff;color:#111;padding:20px 22px;border-radius:14px;max-width:220px;box-shadow:0 20px 60px rgba(0,0,0,.18)}
        .sig-tech-card span{display:block;font-size:9px;letter-spacing:.15em;font-weight:800;color:var(--sig-accent)}
        .sig-tech-card b{display:block;font-family:var(--sig-headline);font-size:20px;line-height:1.05;margin-top:7px}
        .sig-stay-card b,.sig-stay-card span{display:block}.sig-stay-card span{margin-top:7px;color:#666;font-size:11px;line-height:1.5}
        .sig-intro{padding:115px 28px;background:var(--sig-bg)}
        .sig-intro-grid{max-width:1240px;margin:auto;display:grid;grid-template-columns:1.05fr .95fr;gap:80px;align-items:start}
        .sig-intro h2,.sig-section-head h2,.sig-editorial h2,.sig-final h2{font-family:var(--sig-headline);font-weight:650;letter-spacing:-.05em;line-height:.98}
        .sig-intro h2{font-size:clamp(36px,5vw,68px);margin:13px 0 0}
        .sig-intro p{color:var(--sig-muted);line-height:1.9;font-size:15px;max-width:580px;margin:0}
        .sig-stats{display:flex;gap:38px;margin-top:30px}.sig-stats b{display:block;font-family:var(--sig-headline);font-size:28px}.sig-stats span{display:block;color:var(--sig-muted);font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin-top:4px}
        .sig-catalog{padding:92px 28px;background:var(--sig-bg)}
        .sig-catalog-inner{max-width:1240px;margin:auto}
        .sig-section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:34px}.sig-section-head h2{font-size:40px;margin:9px 0 0}.sig-section-head>a{font-size:11px;border-bottom:1px solid var(--sig-accent);padding-bottom:4px}
        .sig-products{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
        .sig-product-image{aspect-ratio:1/1.08;border-radius:var(--sig-radius);background-size:cover;background-position:center;border:1px solid var(--sig-border);position:relative;overflow:hidden}
        .sig-product-image span{position:absolute;top:12px;left:12px;padding:7px 9px;background:var(--sig-accent);color:#111;font-size:8px;font-weight:900;letter-spacing:.1em}
        .sig-product-info{padding:14px 2px}.sig-product-info small{color:var(--sig-accent);text-transform:uppercase;letter-spacing:.13em;font-size:9px}.sig-product-info h3{font-family:var(--sig-headline);font-size:20px;margin:5px 0}.sig-product-info p{color:var(--sig-muted);font-size:11px;line-height:1.5;min-height:17px;margin:0 0 7px}.sig-product-info strong{font-size:12px}
        .sig-editorial{padding:100px 28px;display:grid;grid-template-columns:1fr 1fr;gap:70px;max-width:1320px;margin:auto;align-items:center}.sig-editorial-image{min-height:500px;border-radius:var(--sig-radius);background-size:cover;background-position:center}.sig-editorial-copy{padding:20px}.sig-editorial h2{font-size:clamp(36px,5vw,66px);margin:15px 0 20px}.sig-editorial p{color:var(--sig-muted);line-height:1.85;max-width:500px}.sig-editorial-copy>a{display:inline-block;margin-top:15px;border-bottom:1px solid var(--sig-accent);padding-bottom:4px;font-size:11px}
        .sig-review{padding:90px 28px}.sig-review-inner{max-width:980px;margin:auto;text-align:center}.sig-quote{font-family:var(--sig-headline);font-size:clamp(28px,4vw,50px);line-height:1.1;letter-spacing:-.04em;margin:18px 0 25px}.sig-review-author{color:var(--sig-muted);font-size:11px}
        .sig-final{padding:110px 28px;background:var(--sig-ink);color:var(--sig-bg);text-align:center}.sig-final>div{max-width:800px;margin:auto}.sig-final h2{font-size:clamp(38px,6vw,74px);margin:14px 0 30px}.sig-footer{padding:30px 28px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;background:var(--sig-bg);color:var(--sig-muted);font-size:11px;border-top:1px solid var(--sig-border)}
        /* DISTINCT SIGNATURE SYSTEMS */
        .signature-electra .sig-hero-media{background-image:linear-gradient(90deg,rgba(8,12,20,.82),rgba(8,12,20,.12)),var(--sig-hero)}.signature-electra .sig-hero{background:#08101c}.signature-electra .sig-product-image{border-radius:10px}.signature-electra .sig-products{grid-template-columns:repeat(3,1fr)}.signature-electra .sig-catalog{background:#f4f7fa}
        .signature-atelier .sig-header{background:#f5f0e9}.signature-atelier .sig-hero{min-height:760px}.signature-atelier .sig-hero-media{background-image:linear-gradient(0deg,rgba(30,22,17,.66),transparent 60%),var(--sig-hero)}.signature-atelier .sig-hero h1{font-size:clamp(70px,11vw,150px);max-width:1050px}.signature-atelier .sig-products{grid-template-columns:repeat(4,1fr)}.signature-atelier .sig-product-image{aspect-ratio:3/4;border-radius:0}.signature-atelier .sig-product:nth-child(1){grid-column:span 2}.signature-atelier .sig-product:nth-child(1) .sig-product-image{aspect-ratio:4/5}
        .signature-kinetic{background:#0b0b0b}.signature-kinetic .sig-header,.signature-kinetic .sig-intro,.signature-kinetic .sig-footer{background:#0b0b0b;color:#fff}.signature-kinetic .sig-hero{min-height:720px}.signature-kinetic .sig-hero-media{background-image:linear-gradient(135deg,rgba(0,0,0,.84),rgba(0,0,0,.12)),var(--sig-hero)}.signature-kinetic .sig-hero h1{text-transform:uppercase;font-weight:900}.signature-kinetic .sig-intro{border-top:1px solid #ffffff18}.signature-kinetic .sig-catalog{background:#121212;color:#fff}.signature-kinetic .sig-products{grid-template-columns:repeat(3,1fr);gap:12px}.signature-kinetic .sig-product-image{border-radius:0}.signature-kinetic .sig-final{background:var(--sig-accent);color:#111}
        .signature-bloom{background:#fbf7f3}.signature-bloom .sig-header{background:#fbf7f3}.signature-bloom .sig-hero{min-height:680px;background:#eee3df}.signature-bloom .sig-hero-media{background-image:linear-gradient(90deg,rgba(60,35,40,.62),rgba(60,35,40,.04)),var(--sig-hero)}.signature-bloom .sig-hero h1,.signature-bloom .sig-intro h2,.signature-bloom .sig-section-head h2{font-weight:500}.signature-bloom .sig-products{grid-template-columns:repeat(4,1fr);gap:34px}.signature-bloom .sig-product-image{aspect-ratio:4/5;border-radius:80px 80px 12px 12px}.signature-bloom .sig-final{background:#ead8d2}
        .signature-haven .sig-hero-media{background-image:linear-gradient(90deg,rgba(20,25,21,.65),rgba(20,25,21,.05)),var(--sig-hero)}.signature-haven .sig-intro{background:#edf0e9}.signature-haven .sig-catalog{background:#f7f5ef}.signature-haven .sig-products{grid-template-columns:repeat(3,1fr);gap:18px}.signature-haven .sig-product:nth-child(2){transform:translateY(35px)}.signature-haven .sig-product-image{border-radius:4px}
        .signature-harvest .sig-hero{min-height:600px}.signature-harvest .sig-hero-media{background-image:linear-gradient(90deg,rgba(18,35,18,.65),rgba(18,35,18,.05)),var(--sig-hero)}.signature-harvest .sig-intro{background:#f0f4e9}.signature-harvest .sig-catalog{background:#fff}.signature-harvest .sig-products{grid-template-columns:repeat(4,1fr);gap:14px}.signature-harvest .sig-product-image{aspect-ratio:1/1;border-radius:14px}.signature-harvest .sig-product-info h3{font-family:var(--sig-font);font-size:15px;font-weight:750}
        .signature-maison .sig-hero{min-height:820px}.signature-maison .sig-hero-media{background-image:linear-gradient(180deg,rgba(15,10,7,.1),rgba(15,10,7,.8)),var(--sig-hero)}.signature-maison .sig-hero-content{padding-bottom:95px}.signature-maison .sig-intro{background:#f2ede6}.signature-maison .sig-catalog{background:#17120e;color:#fff}.signature-maison .sig-product-image{aspect-ratio:4/3;border-radius:3px}.signature-maison .sig-final{background:#17120e}
        .signature-ember .sig-hero{min-height:700px;background:#17110e}.signature-ember .sig-hero-media{background-image:linear-gradient(90deg,rgba(15,7,4,.78),rgba(15,7,4,.15)),var(--sig-hero)}.signature-ember .sig-intro{text-align:center;background:#f1e7da}.signature-ember .sig-intro-grid{grid-template-columns:1fr}.signature-ember .sig-intro p{margin:auto}.signature-ember .sig-catalog{background:#17110e;color:#fff}.signature-ember .sig-products{grid-template-columns:repeat(2,1fr);gap:45px}.signature-ember .sig-product-image{aspect-ratio:16/9;border-radius:2px}.signature-ember .sig-final{background:#8b4b28}
        .signature-muse .sig-hero-media{background-image:linear-gradient(90deg,rgba(47,29,45,.58),rgba(47,29,45,.05)),var(--sig-hero)}.signature-muse .sig-intro{background:#f4eef4}.signature-muse .sig-catalog{background:#fff}.signature-muse .sig-products{grid-template-columns:repeat(4,1fr);gap:20px}.signature-muse .sig-product-image{aspect-ratio:4/5;border-radius:120px 120px 12px 12px}.signature-muse .sig-product-info{text-align:center}
        .signature-frame .sig-hero{min-height:760px}.signature-frame .sig-hero-media{background-image:linear-gradient(0deg,rgba(0,0,0,.68),transparent 65%),var(--sig-hero)}.signature-frame .sig-hero h1{font-size:clamp(60px,10vw,130px)}.signature-frame .sig-intro-grid{grid-template-columns:1fr 1fr}.signature-frame .sig-catalog{background:#111;color:#fff}.signature-frame .sig-products{grid-template-columns:repeat(2,1fr);gap:8px}.signature-frame .sig-product-image{aspect-ratio:16/10;border-radius:0}
        .signature-north .sig-hero{background:#101820}.signature-north .sig-hero-media{background-image:linear-gradient(90deg,rgba(10,18,25,.9),rgba(10,18,25,.25)),var(--sig-hero)}.signature-north .sig-intro{background:#e9eef0}.signature-north .sig-catalog{background:#101820;color:#fff}.signature-north .sig-products{grid-template-columns:repeat(3,1fr);gap:1px;background:#ffffff18}.signature-north .sig-product{padding:20px;background:#101820}.signature-north .sig-product-image{display:none}.signature-north .sig-product-info{min-height:160px;display:flex;flex-direction:column;justify-content:end}.signature-north .sig-final{background:#c7d5d9;color:#101820}
        .signature-pure .sig-hero{min-height:610px}.signature-pure .sig-hero-media{background-image:linear-gradient(90deg,rgba(20,45,45,.65),rgba(20,45,45,.05)),var(--sig-hero)}.signature-pure .sig-intro{background:#eaf3f1}.signature-pure .sig-catalog{background:#fff}.signature-pure .sig-products{grid-template-columns:repeat(3,1fr)}.signature-pure .sig-product-image{aspect-ratio:16/10;border-radius:18px}.signature-pure .sig-final{background:#dcebe7;color:#143333}
        .signature-forge .sig-hero{min-height:680px}.signature-forge .sig-hero-media{background-image:linear-gradient(90deg,rgba(20,20,18,.84),rgba(20,20,18,.15)),var(--sig-hero)}.signature-forge .sig-intro{background:#deddd8}.signature-forge .sig-catalog{background:#20211e;color:#fff}.signature-forge .sig-products{grid-template-columns:repeat(3,1fr);gap:0}.signature-forge .sig-product{padding:18px;border:1px solid #ffffff16}.signature-forge .sig-product-image{aspect-ratio:4/3;border-radius:0}.signature-forge .sig-final{background:#b87935;color:#171714}
        @media(max-width:800px){.sig-header-inner{min-height:68px;padding:0 18px}.bn-hamburger{display:block}.sig-links{display:none}.bn-nav-toggle:checked~.sig-links{display:flex;position:absolute;left:12px;right:12px;top:68px;background:var(--sig-bg);padding:18px;flex-direction:column;align-items:stretch;border:1px solid var(--sig-border);box-shadow:0 18px 50px rgba(0,0,0,.12)}.sig-hero{min-height:600px!important}.sig-hero-content{padding:80px 20px 60px}.sig-hero h1{font-size:clamp(46px,14vw,78px)!important}.sig-tech-card,.sig-stay-card,.sig-stamp{display:none}.sig-intro{padding:75px 20px}.sig-intro-grid{grid-template-columns:1fr!important;gap:30px}.sig-catalog{padding:70px 20px}.sig-section-head h2{font-size:32px}.sig-products,.signature-atelier .sig-products,.signature-bloom .sig-products,.signature-harvest .sig-products,.signature-muse .sig-products,.signature-frame .sig-products,.signature-ember .sig-products,.signature-north .sig-products{grid-template-columns:1fr 1fr!important}.sig-product:nth-child(1){grid-column:auto!important}.sig-editorial{grid-template-columns:1fr;padding:70px 20px;gap:25px}.sig-editorial-image{min-height:360px}.sig-final{padding:80px 20px}.sig-footer{padding:25px 20px}.signature-haven .sig-product:nth-child(2){transform:none}.signature-ember .sig-products{gap:20px}}
        @media(max-width:520px){.sig-products,.signature-atelier .sig-products,.signature-bloom .sig-products,.signature-harvest .sig-products,.signature-muse .sig-products,.signature-frame .sig-products,.signature-ember .sig-products,.signature-north .sig-products{grid-template-columns:1fr!important}.sig-stats{gap:20px}.sig-stats b{font-size:23px}}
      `}</style>
    </div>
  );
}
