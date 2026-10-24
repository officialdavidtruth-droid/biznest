// Dedicated home layouts for the Wanderly (travel) and Nestoria (real estate) reference templates.
import Link from "next/link";
import { ArrowRight, BadgeCheck, Globe2, Heart, Home, KeyRound, Search, ShieldCheck, Sparkles, Star, Headphones, Users, MapPin, Calendar, Tag } from "lucide-react";
import { defaultPhoto } from "@/lib/default-images";
import { storeHref as href } from "@/lib/utils/store-href";
import { formatMoney } from "@/lib/utils/format-money";
import type { LegacyCatalogItem } from "@/components/storefront/legacy-template-renderer";

type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };
export type RefProps = { store: any; slug: string; catalogItems: LegacyCatalogItem[]; goodReviews: Review[]; avgRating: number | null; completedOrders: number; social?: Record<string, string> };

const T = [
  "photo-1507525428034-b723cf961d3e", "photo-1533105079780-92b9be482077", "photo-1537996194471-e657df975ab4",
  "photo-1506929562872-bb421503ef21", "photo-1552465011-b4e21bf6e79a", "photo-1476514525535-07fb3b4ae5f1",
].map((i) => defaultPhoto(i, 1400));
const R = [
  "photo-1613490493576-7fde63acd811", "photo-1600585154340-be6161a56a0c", "photo-1600607687939-ce8a6c25118c",
  "photo-1600210492486-724fe5c67fb0", "photo-1512917774080-9991f1c4c750", "photo-1564013799919-ab600027ffc6",
].map((i) => defaultPhoto(i, 1400));
const pick = (u: string | null | undefined, set: string[], i: number) => u || set[i % set.length];
const fill = (items: LegacyCatalogItem[], n: number): (LegacyCatalogItem | null)[] => Array.from({ length: n }, (_, i) => items[i] ?? null);
const itemHref = (slug: string, i: LegacyCatalogItem | null) => i ? href(slug, `/${i.kind}/${i.id}`) : href(slug, "/");
const quote = (r: Review | undefined, i: number) => r ? { t: r.comment!, n: r.author.name || "Customer" } : [
  { t: "Everything was seamless from the first message to the last. Highly recommended.", n: "Verified customer" },
  { t: "Professional, personal and exactly what we were looking for.", n: "Verified customer" },
  { t: "Great experience. We will definitely be back.", n: "Verified customer" }][i];

/* ───────────── WANDERLY ───────────── */
export function WanderlyHome({ p }: { p: RefProps }) {
  const { store, slug, catalogItems: items, goodReviews } = p;
  const dest = fill(items, 4), pk = fill(items.slice(4).length >= 3 ? items.slice(4) : items, 3);
  const hero = store.bannerUrl || T[0];
  const css = `
.wd{--ink:#12334a;--ac:#0b7189;font-family:'Plus Jakarta Sans',Inter,sans-serif;color:var(--ink);background:#fff}
.wd a{color:inherit;text-decoration:none}.wd h1,.wd h2{font-family:'Playfair Display',Georgia,serif}
.wd .hero{position:relative;min-height:600px;background:linear-gradient(90deg,rgba(255,255,255,.55),rgba(255,255,255,0) 60%),url(${hero}) center/cover;padding:26px 5% 110px}
.wd .hd{display:flex;align-items:center;justify-content:space-between}.wd .logo{font:700 26px 'Playfair Display',serif;display:flex;gap:8px;align-items:center}.wd .logo img{height:36px}
.wd nav{display:flex;gap:30px;font-size:13px;font-weight:500}.wd .plan{background:#0f2a43;color:#fff;padding:12px 22px;border-radius:999px;font-size:13px;font-weight:600}
.wd .hc{padding-top:60px;max-width:560px}.wd small.k{font-size:11px;letter-spacing:.16em;font-weight:600}.wd h1{font-size:clamp(44px,6vw,76px);line-height:1.04;margin:14px 0 18px;font-weight:700}
.wd .hc p{font-size:15px;line-height:1.7;max-width:420px;margin:0 0 24px}.wd .cta{display:inline-flex;gap:10px;align-items:center;background:#0f2a43;color:#fff;padding:15px 26px;border-radius:999px;font-weight:600;font-size:14px}
.wd .trust{margin-top:22px;font-size:12px;font-weight:600}
.wd .sb{position:relative;margin:-60px 5% 0;background:#fff;border-radius:18px;box-shadow:0 12px 40px rgba(18,51,74,.14);display:grid;grid-template-columns:repeat(4,1fr) auto;gap:6px;padding:18px 22px;align-items:center}
.wd .sb div{padding:0 14px;border-right:1px solid #e6eef2;font-size:12px;color:#6b8191}.wd .sb b{display:block;color:var(--ink);font-size:13px}.wd .sb a{background:#0f2a43;color:#fff;padding:15px 26px;border-radius:999px;font-weight:600;font-size:13px}
.wd section.s{padding:56px 5% 10px}.wd .sh{display:flex;justify-content:space-between;align-items:end;margin-bottom:22px}.wd h2{font-size:32px;margin:0 0 4px}.wd .sh p{margin:0;font-size:13.5px;color:#6b8191}.wd .sh a{font-size:13px;font-weight:600}
.wd .dg{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.wd .dc{border:1px solid #e6eef2;border-radius:14px;overflow:hidden;background:#fff}.wd .dc img{width:100%;height:170px;object-fit:cover;display:block}
.wd .dc div{padding:14px 16px;display:flex;justify-content:space-between;align-items:center}.wd .dc b{display:block;font-size:15px}.wd .dc small{font-size:10.5px;letter-spacing:.12em;color:#6b8191;text-transform:uppercase}.wd .dc i{width:34px;height:34px;border:1px solid #dde7ec;border-radius:50%;display:flex;align-items:center;justify-content:center}
.wd .pg{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.wd .pc{border:1px solid #e6eef2;border-radius:16px;overflow:hidden}.wd .pc .im{position:relative}.wd .pc img{width:100%;height:210px;object-fit:cover;display:block}
.wd .pc .bd{position:absolute;left:14px;top:14px;background:#fff;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:600;display:flex;gap:6px;align-items:center}
.wd .pc .tx{padding:18px}.wd .pc h3{margin:0 0 6px;font-size:17px}.wd .pc p{margin:0 0 14px;font-size:12.5px;color:#6b8191}.wd .pc .pr{display:flex;justify-content:space-between;align-items:center;font-size:22px;font-weight:700}.wd .pc .pr small{font-size:12px;font-weight:400;color:#6b8191}
.wd .st{margin:50px 0 0;background:linear-gradient(rgba(240,248,252,.92),rgba(240,248,252,.92)),url(${T[4]}) center/cover;display:grid;grid-template-columns:repeat(4,1fr);padding:36px 5%;gap:20px;text-align:left}
.wd .st div{display:flex;gap:14px;align-items:center}.wd .st b{font-size:26px;display:block}.wd .st span{font-size:12px;color:#6b8191}
.wd .tg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.wd .tc{border:1px solid #e6eef2;border-radius:14px;padding:20px;font-size:13px;line-height:1.7}.wd .tc b{display:block;margin-top:10px}
.wd .nl{margin:50px 5% 0;border-radius:18px;padding:46px;color:#fff;background:linear-gradient(90deg,rgba(15,42,67,.88),rgba(15,42,67,.3)),url(${T[3]}) center/cover}
.wd .nl h2{font-size:30px;max-width:420px}.wd .nl form{display:flex;max-width:460px;background:#fff;border-radius:999px;padding:5px;margin-top:16px}.wd .nl input{flex:1;border:0;background:none;padding:0 18px;font-size:13px;outline:0}.wd .nl button{background:#0f2a43;color:#fff;border:0;border-radius:999px;padding:12px 22px;font-weight:600}
.wd footer{background:#0f2a43;color:#cfe0ea;margin-top:-40px;padding:90px 5% 26px;border-radius:40px 40px 0 0;display:flex;justify-content:space-between;gap:30px;font-size:12.5px;flex-wrap:wrap}
@media(max-width:900px){.wd nav{display:none}.wd .sb,.wd .dg,.wd .pg,.wd .tg,.wd .st{grid-template-columns:1fr 1fr}.wd .pg,.wd .tg{grid-template-columns:1fr}}`;
  return <div className="wd"><style>{css}</style>
    <section className="hero"><div className="hd"><Link href={href(slug, "/")} className="logo">{store.logoUrl && <img src={store.logoUrl} alt="" />}{store.name}</Link>
      <nav>{[["Destinations", "/"], ["Tours", "/catalog"], ["About", "/about"], ["Blog", "/blog"], ["Contact", "/contact"]].map(([l, h]) => <Link key={l} href={href(slug, h)}>{l}</Link>)}</nav><Link className="plan" href={href(slug, "/contact")}>Plan Your Trip</Link></div>
      <div className="hc"><small className="k">EXTRAORDINARY PLACES. MEANINGFUL JOURNEYS.</small><h1>{store.heroOverrides?.headline || <>Discover Your Next Adventure</>}</h1><p>{store.heroOverrides?.subtitle || store.business?.description || "Curated travel experiences to the world's most breathtaking destinations."}</p><Link className="cta" href={href(slug, "/catalog")}>Explore Destinations <ArrowRight size={16} /></Link>
        <div className="trust">★ Trusted by {Math.max(p.completedOrders, 50000).toLocaleString()}+ travelers</div></div></section>
    <div className="sb">{[["Where to?", "Search destinations"], ["Travel Dates", "Select dates"], ["Travelers", "2 travelers"], ["Trip Type", "All types"]].map(([a, b]) => <div key={a}><b>{a}</b>{b}</div>)}<Link href={href(slug, "/catalog")}>Search Now →</Link></div>
    <section className="s"><div className="sh"><div><h2>Featured Destinations</h2><p>Iconic places. Unforgettable experiences.</p></div><Link href={href(slug, "/catalog")}>View All Destinations →</Link></div>
      <div className="dg">{dest.map((d, i) => <Link key={i} href={itemHref(slug, d)} className="dc"><img src={pick(d?.image, T, i)} alt="" /><div><span><b>{d?.name || ["Santorini", "Bali", "Maldives", "Phuket"][i]}</b><small>{d?.categoryName || ["Greece", "Indonesia", "Indian Ocean", "Thailand"][i]}</small></span><i><ArrowRight size={14} /></i></div></Link>)}</div></section>
    <section className="s"><div className="sh"><div><h2>Curated Travel Packages</h2><p>Handpicked journeys designed for unforgettable moments.</p></div><Link href={href(slug, "/catalog")}>View All Packages →</Link></div>
      <div className="pg">{pk.map((d, i) => <Link key={i} href={itemHref(slug, d)} className="pc"><div className="im"><img src={pick(d?.image, T, i + 1)} alt="" /><span className="bd"><Star size={12} />{["Bestseller", "Honeymoon", "Cultural"][i]}</span></div>
        <div className="tx"><h3>{d?.name || ["Italian Escape", "Maldives Getaway", "Bali Explorer"][i]}</h3><p>{(d?.description || "Handpicked stays, guides and experiences.").slice(0, 70)}</p><div className="pr"><span>{d ? formatMoney(d.price, d.currency) : ["$1,899", "$2,499", "$1,299"][i]} <small>/ person</small></span><ArrowRight size={18} /></div></div></Link>)}</div></section>
    <div className="st">{[[Users, `${Math.max(p.completedOrders, 50000).toLocaleString()}+`, "Happy Travelers"], [Globe2, "100+", "Global Destinations"], [Star, `${(p.avgRating ?? 4.9).toFixed(1)}/5`, "Customer Rating"], [BadgeCheck, "10+", "Years of Experience"]].map(([I, n, l]: any) => <div key={l}><I size={32} strokeWidth={1.3} /><span><b>{n}</b>{l}</span></div>)}</div>
    <section className="s"><div className="sh"><h2>What Our Travelers Say</h2></div><div className="tg">{[0, 1, 2].map(i => { const q = quote(goodReviews[i], i); return <div className="tc" key={i}><div style={{ color: "#f0a62a" }}>★★★★★</div>“{q.t}”<b>{q.n}</b></div>; })}</div></section>
    <div className="nl"><small className="k">STAY INSPIRED</small><h2>Get Travel Inspiration Straight to Your Inbox</h2><form><input placeholder="Enter your email address" /><button type="button">Subscribe →</button></form></div>
    <footer><b style={{ fontFamily: "Playfair Display,serif", fontSize: 20 }}>{store.name}</b><span>{store.contactEmail || store.business?.email}</span><span>{store.contactPhone || store.business?.phone}</span><span>© {new Date().getFullYear()} {store.name}</span></footer></div>;
}

/* ───────────── NESTORIA ───────────── */
export function NestoriaHome({ p }: { p: RefProps }) {
  const { store, slug, catalogItems: items, goodReviews } = p;
  const props = fill(items, 3); const hero = store.bannerUrl || R[0];
  const css = `
.ns{--ac:#6554d9;--dk:#20194a;font-family:'Plus Jakarta Sans',Inter,sans-serif;color:var(--dk);background:linear-gradient(#f4f1ff,#fff 40%);padding:12px}
.ns a{color:inherit;text-decoration:none}.ns .wrap{background:#fff;border-radius:22px;max-width:1280px;margin:0 auto;padding:18px 30px 40px;box-shadow:0 6px 40px rgba(101,84,217,.08)}
.ns .hd{display:flex;align-items:center;justify-content:space-between;padding:6px 0 16px}.ns .logo{font-weight:800;font-size:20px;display:flex;gap:10px;align-items:center}.ns .logo i{width:34px;height:34px;border-radius:10px;background:#efeaff;display:flex;align-items:center;justify-content:center;color:var(--ac)}.ns .logo img{height:34px}
.ns nav{display:flex;gap:28px;font-size:13px;font-weight:500}.ns nav a:first-child{color:var(--ac);border-bottom:2px solid var(--ac);padding-bottom:4px}.ns .gs{background:var(--dk);color:#fff;padding:11px 20px;border-radius:10px;font-size:13px;font-weight:600}
.ns .hero{position:relative;border-radius:22px;min-height:470px;background:linear-gradient(90deg,rgba(255,255,255,.88),rgba(255,255,255,.1) 62%),url(${hero}) center/cover;padding:46px 50px;overflow:hidden}
.ns .pill{display:inline-flex;gap:8px;align-items:center;background:rgba(255,255,255,.8);padding:8px 14px;border-radius:999px;font-size:12px;color:var(--ac);font-weight:600}
.ns h1{font-size:clamp(38px,5vw,58px);line-height:1.08;font-weight:800;margin:22px 0 14px;max-width:520px}.ns h1 u{text-decoration:none;color:var(--ac);border-bottom:4px solid var(--ac)}.ns .hero p{font-size:15px;max-width:380px;line-height:1.6;margin:0}
.ns .sr{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);width:min(760px,92%);background:#fff;border-radius:999px;box-shadow:0 12px 40px rgba(32,25,74,.18);display:grid;grid-template-columns:repeat(3,1fr) auto;align-items:center;padding:12px 14px 12px 24px;margin-bottom:26px}
.ns .sr div{font-size:11px;color:#7c78a0;border-right:1px solid #eee;padding:0 14px}.ns .sr b{display:block;color:var(--dk);font-size:13px}.ns .sr a{background:var(--ac);color:#fff;padding:15px 30px;border-radius:999px;font-weight:600;font-size:14px}
.ns .tr{position:absolute;right:26px;top:22px;background:rgba(255,255,255,.9);border-radius:999px;padding:8px 16px;font-size:12px;font-weight:600}
.ns .fg{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:34px 0}.ns .fc{border:1px solid #ece9fb;border-radius:14px;padding:16px;display:flex;gap:14px;align-items:center;box-shadow:0 4px 18px rgba(101,84,217,.06)}
.ns .fc i{width:46px;height:46px;border-radius:12px;background:#efeaff;color:var(--ac);display:flex;align-items:center;justify-content:center;flex:none}.ns .fc b{display:block;font-size:13.5px}.ns .fc span{font-size:11.5px;color:#7c78a0}
.ns .why{display:grid;grid-template-columns:1fr 1.15fr;gap:40px;align-items:center;margin:50px 0}.ns .why small{color:var(--ac);font-weight:700;letter-spacing:.14em;font-size:11px}.ns .why h2{font-size:38px;line-height:1.1;margin:10px 0 14px;font-weight:800}.ns .why p{font-size:14px;color:#6c688f;line-height:1.7}
.ns .why li{list-style:none;display:flex;gap:10px;font-size:14px;margin:12px 0}.ns .why li:before{content:"✓";background:var(--ac);color:#fff;width:20px;height:20px;border-radius:50%;font-size:12px;display:flex;align-items:center;justify-content:center;flex:none}
.ns .why img{width:100%;height:340px;object-fit:cover;border-radius:18px}.ns .lm{display:inline-block;background:var(--dk);color:#fff;padding:14px 24px;border-radius:10px;font-weight:600;font-size:13px;margin-top:12px}
.ns h3.t{font-size:20px;margin:36px 0 16px;display:flex;justify-content:space-between}.ns h3.t a{font-size:12px;font-weight:500}
.ns .pg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.ns .pc{border:1px solid #ece9fb;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(101,84,217,.06)}
.ns .pc .im{position:relative}.ns .pc img{width:100%;height:190px;object-fit:cover;display:block}.ns .pc .tag{position:absolute;left:12px;top:12px;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700}
.ns .pc .hr{position:absolute;right:12px;top:12px;background:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center}
.ns .pc .tx{padding:16px}.ns .pc h4{margin:0 0 4px;font-size:15px}.ns .pc small{font-size:12px;color:#7c78a0}.ns .pc .pr{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-weight:800;font-size:18px}.ns .pc .pr small{font-weight:400}.ns .pc .vd{background:var(--dk);color:#fff;padding:9px 16px;border-radius:8px;font-size:12px;font-weight:600}
.ns .how{text-align:center}.ns .how small{color:var(--ac);font-weight:700;letter-spacing:.14em;font-size:10.5px}.ns .hg{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px;text-align:left}
.ns .hg div{border:1px solid #ece9fb;border-radius:16px;padding:18px;display:flex;gap:14px;align-items:center}.ns .hg i{width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#8b7bf0,#6554d9);color:#fff;display:flex;align-items:center;justify-content:center;flex:none}.ns .hg b{display:block;font-size:14px}.ns .hg span{font-size:12px;color:#7c78a0}
.ns .tg{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.ns .tc{border:1px solid #ece9fb;border-radius:14px;padding:16px;font-size:12.5px;line-height:1.6;color:#6c688f}.ns .tc b{display:block;color:var(--dk);margin-bottom:6px}
.ns .cta{margin-top:30px;border-radius:18px;padding:34px 40px;color:#fff;background:linear-gradient(90deg,#20194a,#6554d9);display:flex;justify-content:space-between;align-items:center}.ns .cta b{font-size:22px;display:block}.ns .cta a{background:#fff;color:var(--dk);padding:14px 26px;border-radius:10px;font-weight:700;font-size:13px}
@media(max-width:900px){.ns nav{display:none}.ns .fg,.ns .pg,.ns .hg,.ns .tg,.ns .why{grid-template-columns:1fr}.ns .sr{position:static;transform:none;grid-template-columns:1fr;border-radius:20px;margin-top:20px}}`;
  return <div className="ns"><style>{css}</style><div className="wrap">
    <div className="hd"><Link href={href(slug, "/")} className="logo">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : <i><Home size={18} /></i>}{store.name}</Link>
      <nav>{[["Home", "/"], ["Listings", "/catalog"], ["Services", "/services"], ["Favorites", "/account"], ["Blog", "/blog"], ["About Us", "/about"]].map(([l, h]) => <Link key={l} href={href(slug, h)}>{l}</Link>)}</nav><Link className="gs" href={href(slug, "/contact")}>Get Started</Link></div>
    <section className="hero"><span className="tr">★ Trusted by {Math.max(p.completedOrders, 25000).toLocaleString()}+ happy families</span><span className="pill"><Home size={14} /> Dream • Search • Own</span>
      <h1>{store.heroOverrides?.headline || <>Discover Spaces That Feel Like <u>Home</u></>}</h1><p>{store.heroOverrides?.subtitle || store.business?.description || "Find handpicked properties for rent or sale that match your lifestyle and budget."}</p>
      <div className="sr">{[["Location", store.business?.city || "Anywhere"], ["Property Type", "Any Type"], ["Price Range", "Any budget"]].map(([a, b]) => <div key={a}><b>{b}</b>{a}</div>)}<Link href={href(slug, "/catalog")}>Search</Link></div></section>
    <div className="fg">{[[ShieldCheck, "Verified Properties", "All properties are verified"], [Sparkles, "Safe & Secure", "Your safety is our priority"], [Headphones, "24/7 Support", "Here to help anytime"], [Tag, "Best Price Guarantee", "The best deals at the best prices"]].map(([I, a, b]: any) => <div className="fc" key={a}><i><I size={22} /></i><span><b>{a}</b>{b}</span></div>)}</div>
    <section className="why"><div><small>WHY CHOOSE {store.name.toUpperCase()}</small><h2>More Than Just A Property</h2><p>We offer more than just spaces. We deliver experiences that fit your life and future.</p><ul style={{ padding: 0 }}>{["Wide range of premium options", "Flexible terms & easy agreements", "Personalized recommendations", "Trusted by thousands of happy clients"].map(t => <li key={t}>{t}</li>)}</ul><Link className="lm" href={href(slug, "/about")}>Learn More →</Link></div><img src={R[3]} alt="" /></section>
    <h3 className="t">Featured Properties <Link href={href(slug, "/catalog")}>View All Properties →</Link></h3>
    <div className="pg">{props.map((d, i) => <Link key={i} href={itemHref(slug, d)} className="pc"><div className="im"><img src={pick(d?.image, R, i)} alt="" /><span className="tag" style={{ background: ["#e6defc", "#d8f5e1", "#fde2e0"][i], color: ["#6554d9", "#2a8a4a", "#c24235"][i] }}>{["Featured", "New", "Hot Deal"][i]}</span><span className="hr"><Heart size={14} /></span></div>
      <div className="tx"><h4>{d?.name || ["Modern Ocean Villa", "Urban Luxury Apartment", "Sunny Autumn House"][i]}</h4><small>{d?.categoryName || "Listing"}</small><div className="pr"><span>{d ? formatMoney(d.price, d.currency) : "—"}<small> / month</small></span><span className="vd">View Details</span></div></div></Link>)}</div>
    <section className="how" style={{ marginTop: 44 }}><small>HOW IT WORKS</small><h3 style={{ fontSize: 22, margin: "6px 0 0" }}>Find Your Dream Home in 3 Easy Steps</h3><div className="hg">{[[Search, "Search & Explore", "Browse verified listings in your desired location."], [Home, "Choose Your Property", "Compare options and find the perfect space."], [KeyRound, "Move In & Enjoy", "Complete the process with confidence."]].map(([I, a, b]: any, i) => <div key={a}><i><I size={22} /></i><span><b>0{i + 1} {a}</b>{b}</span></div>)}</div></section>
    <h3 className="t" style={{ justifyContent: "center" }}>What Our Clients Say</h3><div className="tg">{[0, 1, 2].map(i => { const q = quote(goodReviews[i], i); return <div className="tc" key={i}><b>{q.n} <span style={{ color: "#f0a62a" }}>★★★★★</span></b>“{q.t}”</div>; })}</div>
    <div className="cta"><span><b>Ready to Find Your Dream Home?</b>Join thousands of happy families who found their perfect space with {store.name}.</span><Link href={href(slug, "/contact")}>Get Started →</Link></div>
  </div></div>;
}
