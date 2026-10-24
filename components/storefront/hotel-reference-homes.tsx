"use client";
// Dedicated home layouts for the reference hotel templates (Aspire, Larita, Skyview).
// Each one follows its reference design's structure; content comes from the store's own data.
import Link from "next/link";
import { ArrowRight, BedDouble, CalendarDays, Check, MapPin, Phone, Play, ShieldCheck, Sparkles, Star, User, Utensils, Waves, Wifi, Car, Dumbbell } from "lucide-react";
import { defaultPhoto } from "@/lib/default-images";
import { storeHref as href } from "@/lib/utils/store-href";
import { formatMoney } from "@/lib/utils/format-money";
import type { HotelContent, HotelRoom } from "@/lib/hotel-content";

type Store = { name: string; logoUrl?: string | null; bannerUrl?: string | null; address?: string | null; phone?: string | null; contactPhone?: string | null; email?: string | null; contactEmail?: string | null; business?: { description?: string | null } | null };
type P = { store: Store; slug: string; content: HotelContent };

const PH = [
  defaultPhoto("photo-1631049307264-da0ec9d70304", 1200), defaultPhoto("photo-1618773928121-c32242e63f39", 1200),
  defaultPhoto("photo-1582719478250-c89cae4dc85b", 1200), defaultPhoto("photo-1566073771259-6a8506099945", 1200),
  defaultPhoto("photo-1590490360182-c33d57733427", 1200), defaultPhoto("photo-1571896349842-33c89424de2d", 1200),
];
const ph = (u: string | null | undefined, i: number) => u || PH[i % PH.length];
const money = (n: number) => formatMoney(n);
const NAV: [string, string][] = [["Home", "/"], ["Rooms", "/rooms"], ["Amenities", "/amenities"], ["Dining", "/dining"], ["Gallery", "/gallery"], ["About", "/about"], ["Contact", "/contact"]];
const first = (s: string) => s.split(/\s+[—-]\s+/)[0];

function rooms(c: HotelContent): HotelRoom[] { return c.rooms.length ? c.rooms : []; }
function Logo({ store, slug, cls }: { store: Store; slug: string; cls: string }) {
  return <Link href={href(slug, "/")} className={cls}>{store.logoUrl ? <img src={store.logoUrl} alt={store.name} /> : null}<b>{store.name}</b></Link>;
}
function Nav({ slug, labels = NAV }: { slug: string; labels?: [string, string][] }) {
  return <nav>{labels.map(([l, h]) => <Link key={l} href={href(slug, h)}>{l}</Link>)}</nav>;
}
const FEATURE_ICONS = [MapPin, BedDouble, User, Sparkles];

/* ───────────────────────── ASPIRE ───────────────────────── */
function Aspire({ store, slug, content }: P) {
  const rs = rooms(content).slice(0, 3); const hero = ph(store.bannerUrl, 0);
  const phone = store.contactPhone || store.phone || "—";
  return <div className="rh-aspire">
    <style>{`
.rh-aspire{background:#21150f;color:#f7e8ce;font-family:var(--lux-sans,Inter,sans-serif)}
.rh-aspire a{color:inherit;text-decoration:none}
.rh-aspire .hd{position:absolute;inset:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding:26px 6%;z-index:3}
.rh-aspire .logo{display:flex;align-items:center;gap:10px;font:400 30px var(--lux-serif,'Playfair Display',serif);color:#e2c28a}
.rh-aspire .logo img{height:40px}.rh-aspire nav{display:flex;gap:30px;align-items:center;font-size:14px}.rh-aspire nav a:first-child{color:#e2c28a;border-bottom:1px solid #e2c28a;padding-bottom:3px}
.rh-aspire .bk{background:#c69a52;color:#21150f!important;padding:10px 18px;font-size:11px;font-weight:700;letter-spacing:.14em;border-radius:3px}
.rh-aspire .hero{position:relative;min-height:640px;background:linear-gradient(90deg,rgba(25,14,8,.88),rgba(25,14,8,.35)),url(HERO) center/cover;display:flex;flex-direction:column;justify-content:center;padding:120px 6% 150px}
.rh-aspire h1{font:400 clamp(44px,6vw,76px)/1.12 var(--lux-serif,'Playfair Display',serif);color:#e2c28a;margin:0 0 18px;max-width:640px}
.rh-aspire .hero p{font-size:17px;max-width:520px;margin:0 0 28px;color:#f1e1c6}
.rh-aspire .cta{display:inline-block;background:#c69a52;color:#21150f;padding:14px 26px;font-size:12px;font-weight:700;letter-spacing:.16em;border-radius:3px}
.rh-aspire .strip{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:-70px 6% 0;position:relative;background:rgba(22,14,9,.9);border:1px solid #5a4030}
.rh-aspire .strip div{padding:26px 28px;display:flex;gap:16px;align-items:center;border-right:1px solid #5a4030}.rh-aspire .strip div:last-child{border:0}
.rh-aspire .strip small{display:block;font-size:11px;letter-spacing:.16em;font-weight:700;color:#e2c28a}.rh-aspire .strip span{font-size:15px}
.rh-aspire .rooms{padding:80px 6% 30px;display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.rh-aspire .rooms h3{font:400 28px var(--lux-serif,'Playfair Display',serif);color:#e2c28a;margin:0 0 10px}.rh-aspire .rooms .d{font-size:13px;color:#c5b5a2;line-height:1.7;margin:0 0 20px;min-height:44px}
.rh-aspire .card{background:#2c1e16;border:1px solid #4a3425;border-radius:4px;overflow:hidden}.rh-aspire .card img{width:100%;height:230px;object-fit:cover;display:block}
.rh-aspire .card .b{padding:22px}.rh-aspire .card h4{margin:0 0 8px;font-size:13px;letter-spacing:.14em;font-weight:700}.rh-aspire .card p{font-size:13px;color:#c5b5a2;margin:0 0 18px;border-bottom:1px solid #5a4030;padding-bottom:16px}
.rh-aspire .from{display:inline-block;background:#c69a52;color:#21150f;padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:.1em;border-radius:3px}
.rh-aspire .disc{padding:70px 6% 90px;display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:28px;align-items:center}
.rh-aspire .disc h2{font:400 clamp(30px,3.4vw,42px) var(--lux-serif,'Playfair Display',serif);margin:0 0 20px;color:#e2c28a}.rh-aspire .disc h2 em{color:#c69a52;font-style:normal}
.rh-aspire .disc p{font-size:14px;line-height:1.8;color:#e5d4b8;margin:0 0 16px}.rh-aspire .disc img{width:100%;height:330px;object-fit:cover;border-radius:3px}
.rh-aspire .ghost{display:inline-block;border:1px solid #c69a52;color:#e2c28a;padding:12px 20px;font-size:11px;letter-spacing:.14em;margin-top:8px}
.rh-aspire footer{border-top:1px solid #5a4030;padding:28px 6%;display:flex;justify-content:space-between;font-size:12px;color:#c5b5a2}
@media(max-width:860px){.rh-aspire nav{display:none}.rh-aspire .strip,.rh-aspire .rooms,.rh-aspire .disc{grid-template-columns:1fr}.rh-aspire .strip div{border-right:0;border-bottom:1px solid #5a4030}}
`.replace("HERO", hero)}</style>
    <section className="hero">
      <div className="hd"><Logo store={store} slug={slug} cls="logo" /><Nav slug={slug} labels={[["Home", "/"], ["Rooms", "/rooms"], ["Dining", "/dining"], ["Contact", "/contact"]]} /><Link className="bk" href={href(slug, "/book")}>BOOK NOW</Link></div>
      <h1>{content.skin?.headline || "Experience Five-Star Luxury"}</h1>
      <p>{content.skin?.sub || content.home.subtitle}</p>
      <Link className="cta" href={href(slug, "/book")}>BOOK YOUR STAY</Link>
    </section>
    <div className="strip">
      <div><CalendarDays color="#e2c28a" /><div style={{ padding: 0, border: 0, display: "block" }}><small>CHECK-IN / OUT</small><span>3:00 PM / 11:00 AM</span></div></div>
      <div><MapPin color="#e2c28a" /><div style={{ padding: 0, border: 0, display: "block" }}><small>LOCATION</small><span>{store.address || "Visit us"}</span></div></div>
      <div><Phone color="#e2c28a" /><div style={{ padding: 0, border: 0, display: "block" }}><small>CUSTOMER SUPPORT</small><span>{phone}</span></div></div>
    </div>
    <section className="rooms">{rs.map((r, i) => <div key={r.id}><h3>{r.name}</h3><p className="d">{r.description.slice(0, 110)}</p>
      <Link href={href(slug, `/rooms/${r.slug}`)} className="card" style={{ display: "block" }}><img src={ph(r.image, i)} alt={r.name} /><div className="b"><h4>{r.name.toUpperCase()}</h4><p>{r.guests} guests · {r.bed || r.area}</p><span className="from">FROM {money(r.price)} / NIGHT</span></div></Link></div>)}</section>
    <section className="disc"><div><h2>Discover Refined <em>Luxury</em></h2><p>{content.home.body || "Thoughtful rooms, warm service and an unhurried pace. Every detail is considered so your stay feels effortless."}</p><Link className="ghost" href={href(slug, "/about")}>BOOK ROOMS ›</Link></div>
      <img src={ph(content.gallery[0]?.image, 1)} alt="" /><img src={ph(content.gallery[1]?.image, 2)} alt="" /></section>
    <footer><span>© {store.name}</span><span>{store.address}</span></footer>
  </div>;
}

/* ───────────────────────── LARITA ───────────────────────── */
function Larita({ store, slug, content }: P) {
  const rs = rooms(content); const room = rs[0]; const hero = ph(store.bannerUrl, 4);
  const am = content.amenities.slice(0, 6);
  const AM = [Wifi, Car, Utensils, Sparkles, Dumbbell, Waves];
  return <div className="rh-larita">
    <style>{`
.rh-larita{background:#fff;color:#181716;font-family:var(--lux-sans,'Plus Jakarta Sans',sans-serif)}
.rh-larita a{color:inherit;text-decoration:none}
.rh-larita .hero{position:relative;min-height:620px;background:linear-gradient(rgba(20,15,12,.55),rgba(20,15,12,.7)),url(HERO) center/cover;color:#fff;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:120px 6% 90px}
.rh-larita .hd{position:absolute;inset:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding:22px 5%;font-size:11px;letter-spacing:.14em}
.rh-larita .hd nav{display:flex;gap:30px}.rh-larita .logo{font:400 24px Georgia,serif;letter-spacing:.12em;text-transform:uppercase;display:flex;gap:8px;align-items:center}.rh-larita .logo img{height:34px}
.rh-larita .res{background:#b58a69;padding:12px 18px;color:#fff;text-transform:uppercase}
.rh-larita h1{font:400 clamp(34px,5vw,58px) Georgia,serif;letter-spacing:.04em;text-transform:uppercase;margin:12px 0 16px}
.rh-larita .hero p{max-width:540px;font-size:15px;line-height:1.7;margin:0 0 22px}.rh-larita .exp{letter-spacing:.2em;font-size:12px}
.rh-larita .since{position:absolute;left:5%;bottom:0;display:flex;font-size:11px}.rh-larita .since span{background:#fff;color:#181716;padding:14px 20px}.rh-larita .since b{background:#b58a69;padding:14px 20px;font-weight:600}
.rh-larita .feat{display:grid;grid-template-columns:repeat(4,1fr);gap:30px;padding:56px 5%;text-align:center;border-bottom:1px solid #eee}
.rh-larita .feat svg{color:#b58a69;margin-bottom:14px}.rh-larita .feat h4{font:400 18px Georgia,serif;margin:0 0 8px}.rh-larita .feat p{font-size:12.5px;color:#77716d;line-height:1.6;margin:0}
.rh-larita .wel{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:center;padding:80px 5%}
.rh-larita .imgs{display:grid;grid-template-columns:1fr 1fr;gap:16px}.rh-larita .imgs img{width:100%;height:300px;object-fit:cover}.rh-larita .imgs img+img{margin-top:-30px}
.rh-larita small.e{display:block;letter-spacing:.2em;color:#b58a69;font-size:11px;text-transform:uppercase;margin-bottom:12px}
.rh-larita h2{font:400 clamp(28px,3.4vw,42px)/1.15 Georgia,serif;margin:0 0 18px}.rh-larita .wel p{font-size:14px;line-height:1.85;color:#55504c}
.rh-larita .btn{display:inline-block;background:#b58a69;color:#fff!important;padding:13px 22px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;margin-top:10px}
.rh-larita .rate{display:flex;justify-content:center;gap:50px;padding:10px 5% 70px;font-size:13px;color:#55504c;flex-wrap:wrap}.rh-larita .rate b{font-size:20px;color:#181716}
.rh-larita .col{background:#f5f1ed;padding:70px 5%;text-align:center}.rh-larita .col h2{margin-bottom:30px}
.rh-larita .slide{display:grid;grid-template-columns:1fr 1fr;background:#fff;text-align:left;max-width:1180px;margin:0 auto}
.rh-larita .slide .t{padding:46px}.rh-larita .slide .t b.pr{font:400 38px Georgia,serif}.rh-larita .slide .t h3{font:400 26px Georgia,serif;margin:6px 0 10px}.rh-larita .slide .t p{font-size:13px;color:#77716d;line-height:1.7}
.rh-larita .slide img{width:100%;height:100%;min-height:320px;object-fit:cover}
.rh-larita .fac{padding:80px 5%;text-align:center}.rh-larita .fg{display:grid;grid-template-columns:repeat(3,1fr);gap:34px 40px;text-align:left;max-width:1180px;margin:34px auto 0}
.rh-larita .fg div{display:flex;gap:14px}.rh-larita .fg svg{color:#b58a69;flex:none}.rh-larita .fg h5{font:400 17px Georgia,serif;margin:0 0 6px}.rh-larita .fg p{font-size:12.5px;color:#77716d;margin:0;line-height:1.6}
.rh-larita .vid{position:relative;min-height:380px;background:linear-gradient(rgba(20,15,12,.6),rgba(20,15,12,.6)),url(VID) center/cover;color:#fff;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.rh-larita .vid b{width:64px;height:64px;border-radius:50%;background:#b58a69;display:flex;align-items:center;justify-content:center}
.rh-larita footer{background:#24201d;color:#d9d2cb;padding:28px 5%;font-size:12px;display:flex;justify-content:space-between}
@media(max-width:860px){.rh-larita .hd nav{display:none}.rh-larita .feat,.rh-larita .wel,.rh-larita .slide,.rh-larita .fg{grid-template-columns:1fr}}
`.replace("HERO", hero).replace("VID", ph(content.gallery[2]?.image, 5))}</style>
    <section className="hero">
      <div className="hd"><Nav slug={slug} labels={[["HOME", "/"], ["ROOMS & SUITES", "/rooms"], ["EXPLORE", "/about"], ["OFFERS", "/blog"], ["CONTACT", "/contact"]]} /><Logo store={store} slug={slug} cls="logo" /><Link className="res" href={href(slug, "/book")}>Reservation</Link></div>
      <div style={{ color: "#e6a935", letterSpacing: 4 }}>★★★★★</div>
      <h1>{store.name}</h1><p>{content.skin?.sub || content.home.subtitle}</p><Link className="exp" href={href(slug, "/rooms")}>EXPLORE →</Link>
      <div className="since"><span>SINCE {new Date().getFullYear() - 5} · TRUSTED HOSPITALITY</span><b>OUR STORY →</b></div>
    </section>
    <section className="feat">{["Located in the heart of the city", "Luxurious, modern and comfortable", "Friendly and welcoming staff", "Best prices and great offers"].map((t, i) => { const I = FEATURE_ICONS[i]; return <div key={t}><I size={34} strokeWidth={1.2} /><h4>{t}</h4><p>Thoughtful details that make every stay easy and memorable.</p></div>; })}</section>
    <section className="wel"><div className="imgs"><img src={ph(content.gallery[0]?.image, 2)} alt="" /><img src={ph(content.gallery[1]?.image, 3)} alt="" /></div>
      <div><small className="e">Welcome to {first(store.name)}</small><h2>{content.skin?.headline || "Luxury hotel in the heart of the city."}</h2><p>{content.home.body || content.home.subtitle}</p><Link className="btn" href={href(slug, "/about")}>Read more →</Link></div></section>
    <div className="rate">{["Booking", "Agoda", "Tripadvisor"].map((n, i) => <span key={n}><b>{["4.9", "5.0", "4.8"][i]}</b> ★ Excellent · reviews on {n}</span>)}</div>
    {room && <section className="col"><small className="e">Exquisite and luxurious</small><h2>Room and suite collection</h2>
      <div className="slide"><div className="t"><span style={{ fontSize: 13 }}>From:</span> <b className="pr">{money(room.price)}</b><small>/NIGHT</small><h3>{room.name}</h3><p>{room.description}</p><p>{room.area} · {room.bed} · {room.guests} guests</p><Link className="btn" href={href(slug, "/book")}>Book now</Link> <Link className="btn" style={{ background: "#fff", color: "#181716", border: "1px solid #181716" }} href={href(slug, `/rooms/${room.slug}`)}>View room →</Link></div><img src={ph(room.image, 4)} alt={room.name} /></div></section>}
    <section className="fac"><small className="e">Modern and comfortable</small><h2>Facilities and amenities</h2>
      <div className="fg">{(am.length ? am.map(a => [a.title, a.description]) : [["High Speed Wifi", "Seamless internet access throughout the hotel."], ["Parking Space", "Secure parking for all guests."], ["Restaurant & Bar", "Gourmet dishes and cocktails."], ["Spa Center", "Relaxing and rejuvenating treatments."], ["Fitness Center", "Modern gym equipment."], ["Swimming Pool", "Our pristine outdoor pool."]]).map(([t, d], i) => { const I = AM[i % 6]; return <div key={t}><I size={30} strokeWidth={1.2} /><div><h5>{t}</h5><p>{d}</p></div></div>; })}</div></section>
    <section className="vid"><small className="e" style={{ color: "#fff" }}>Hotel video</small><h2 style={{ margin: 0 }}>Explore {store.name}</h2><b><Play fill="#fff" /></b></section>
    <footer><span>© {store.name}</span><span>{store.address}</span></footer>
  </div>;
}

/* ───────────────────────── SKYVIEW ───────────────────────── */
function Skyview({ store, slug, content }: P) {
  const rs = rooms(content).slice(0, 4); const hero = ph(store.bannerUrl, 3); const offer = content.offers[0];
  const exp = (content.gallery.length ? content.gallery : []).slice(0, 4);
  return <div className="rh-sky">
    <style>{`
.rh-sky{background:#eef5fc;color:#102e4b;font-family:var(--lux-sans,'Plus Jakarta Sans',sans-serif)}
.rh-sky a{color:inherit;text-decoration:none}
.rh-sky .hero{position:relative;min-height:600px;background:linear-gradient(180deg,rgba(10,35,56,.55),rgba(10,35,56,.15) 60%),url(HERO) center/cover;color:#fff;padding:30px 5% 0;display:flex;flex-direction:column}
.rh-sky .hd{display:flex;justify-content:space-between;align-items:center;font-size:13px}.rh-sky .hd nav{display:flex;gap:30px}.rh-sky .logo{font:400 26px Georgia,serif;display:flex;gap:8px;align-items:center}.rh-sky .logo img{height:36px}
.rh-sky .bk{background:#0a2338;padding:11px 20px;border-radius:8px;font-weight:600}
.rh-sky .hc{margin-top:auto;padding-bottom:60px}.rh-sky .hc small{letter-spacing:.2em;font-size:12px}
.rh-sky h1{font:400 clamp(40px,5.4vw,66px)/1.08 var(--lux-serif,Georgia,serif);margin:14px 0 14px;max-width:560px}.rh-sky .hc p{max-width:460px;font-size:15px;line-height:1.7;margin:0 0 30px}
.rh-sky .bar{display:grid;grid-template-columns:repeat(3,1fr) auto;gap:0;background:#fff;color:#102e4b;border-radius:10px;padding:14px 20px;max-width:760px;align-items:center}
.rh-sky .bar div{padding:0 16px;border-right:1px solid #e3ecf4;font-size:12px}.rh-sky .bar b{display:block;font-size:13px}.rh-sky .bar a{background:#0a2338;color:#fff;padding:14px 22px;border-radius:8px;font-weight:600;font-size:13px}
.rh-sky .feats{display:grid;grid-template-columns:repeat(5,1fr);gap:20px;padding:36px 5%;border-bottom:1px solid #dbe7f2;background:#f4f8fd}
.rh-sky .feats div{display:flex;gap:12px;align-items:center;font-size:13px}.rh-sky .feats svg{color:#1d638a;flex:none}.rh-sky .feats small{display:block;color:#5d7387;font-size:11.5px}
.rh-sky .rm{display:grid;grid-template-columns:260px 1fr;gap:40px;padding:70px 5%;background:#f4f8fd}
.rh-sky small.e{letter-spacing:.18em;font-size:11px;color:#5d7387;text-transform:uppercase}.rh-sky h2{font:400 clamp(26px,3vw,36px)/1.2 Georgia,serif;margin:10px 0 14px}.rh-sky .rm p{font-size:13.5px;color:#5d7387;line-height:1.7}
.rh-sky .ol{display:inline-block;border:1px solid #1d638a;color:#1d638a;padding:11px 20px;border-radius:8px;font-size:13px;margin-top:12px}
.rh-sky .rg{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.rh-sky .rc{background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 2px 10px rgba(16,46,75,.06)}
.rh-sky .rc img{width:100%;height:150px;object-fit:cover;display:block}.rh-sky .rc div{padding:14px}.rh-sky .rc h5{margin:0 0 6px;font-size:14px}.rh-sky .rc span{font-size:11.5px;color:#5d7387}.rh-sky .rc b{display:block;margin-top:12px;font-size:18px}
.rh-sky .split{display:grid;grid-template-columns:1fr 1fr}.rh-sky .dest{background:linear-gradient(90deg,rgba(10,35,56,.85),rgba(10,35,56,.3)),url(DEST) center/cover;color:#fff;padding:70px 5%;min-height:340px}
.rh-sky .dest h2{font-size:34px}.rh-sky .dest .ol{border-color:#fff;color:#fff}
.rh-sky .xp{padding:60px 5%;background:#eef5fc}.rh-sky .xg{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}.rh-sky .xg img{width:100%;height:150px;object-fit:cover;border-radius:6px}.rh-sky .xg span{font-size:13px;font-weight:600;display:block;margin-top:8px}
.rh-sky .adv{display:grid;grid-template-columns:1fr 1.1fr 1fr;gap:26px;padding:70px 5%;align-items:center}.rh-sky .adv img{width:100%;height:300px;object-fit:cover;border-radius:8px}
.rh-sky .ag{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.rh-sky .ag div{background:#e6eff9;border-radius:8px;padding:14px;font-size:12.5px}.rh-sky .ag b{display:block;font-size:13.5px}
.rh-sky .q{background:#fff;border-radius:10px;padding:26px;font-size:14px;line-height:1.7}
.rh-sky .off{background:linear-gradient(90deg,rgba(10,35,56,.9),rgba(10,35,56,.5)),url(OFF) center/cover;color:#fff;padding:70px 5%}.rh-sky .off h2{font-size:34px;max-width:560px}.rh-sky .off .ol{background:#fff;color:#0a2338;border-color:#fff}
.rh-sky footer{background:#0a2338;color:#cfdce8;padding:26px 5%;display:flex;justify-content:space-between;font-size:12px}
@media(max-width:900px){.rh-sky .hd nav{display:none}.rh-sky .feats,.rh-sky .rm,.rh-sky .split,.rh-sky .adv,.rh-sky .rg,.rh-sky .xg,.rh-sky .bar{grid-template-columns:1fr 1fr}.rh-sky .rm,.rh-sky .split,.rh-sky .adv{grid-template-columns:1fr}}
`.replace("HERO", hero).replace("DEST", ph(content.gallery[1]?.image, 2)).replace("OFF", ph(content.gallery[3]?.image, 5))}</style>
    <section className="hero">
      <div className="hd"><Logo store={store} slug={slug} cls="logo" /><Nav slug={slug} labels={[["Home", "/"], ["Rooms", "/rooms"], ["Experiences", "/experiences"], ["Gallery", "/gallery"], ["About", "/about"], ["Contact", "/contact"]]} /><Link className="bk" href={href(slug, "/book")}>Book Now →</Link></div>
      <div className="hc"><small>LUXURY STAYS. UNFORGETTABLE JOURNEYS.</small><h1>{content.skin?.headline || "Your Perfect Getaway Awaits"}</h1><p>{content.skin?.sub || content.home.subtitle}</p>
        <div className="bar"><div><b>Destination</b>{first(store.address || "Where are you going?")}</div><div><b>Check In</b>Select date</div><div><b>Guests</b>2 Adults</div><Link href={href(slug, "/book")}>Search Rooms →</Link></div></div>
    </section>
    <section className="feats">{[[BedDouble, "Luxury Rooms & Suites", "Elegant spaces"], [Sparkles, "World-Class Amenities", "Pool, spa, fitness"], [Utensils, "Fine Dining", "Local ingredients"], [MapPin, "Prime Locations", "Nature & coast"], [ShieldCheck, "Trusted & Safe", "Your comfort first"]].map(([I, t, s]: any) => <div key={t}><I /><span><b>{t}</b><small>{s}</small></span></div>)}</section>
    <section className="rm"><div><small className="e">Featured stays</small><h2>Exquisite Rooms &amp; Suites</h2><p>Thoughtfully designed for your comfort, our rooms blend modern luxury with natural beauty.</p><Link className="ol" href={href(slug, "/rooms")}>View All Rooms →</Link></div>
      <div className="rg">{rs.map((r, i) => <Link key={r.id} href={href(slug, `/rooms/${r.slug}`)} className="rc"><img src={ph(r.image, i)} alt={r.name} /><div><h5>{r.name}</h5><span>{r.guests} Guests · {r.bed || r.area}</span><b>{money(r.price)} <small style={{ fontWeight: 400, fontSize: 11 }}>/ night</small></b></div></Link>)}</div></section>
    <section className="split"><div className="dest"><small>TOP DESTINATION</small><h2>Experience Paradise at Our Resort</h2><p style={{ maxWidth: 380, fontSize: 14 }}>{content.experiences.subtitle}</p><Link className="ol" href={href(slug, "/experiences")}>Explore Resort →</Link></div>
      <div className="xp"><h2 style={{ fontSize: 28 }}>Hotel Experiences</h2><small style={{ color: "#5d7387" }}>More than a stay — a journey of unforgettable moments.</small><div className="xg">{(exp.length ? exp.map(g => [g.title, g.image]) : [["Spa & Wellness", ""], ["Culinary Journey", ""], ["Adventure Tours", ""], ["Local Culture", ""]]).map(([t, im], i) => <div key={t + i}><img src={ph(im, i + 1)} alt="" /><span>{t}</span></div>)}</div></div></section>
    <section className="adv"><div><small className="e">Why choose us</small><h2>The {first(store.name)} Advantage</h2><div className="ag">{[["5-Star Service", "Always at your service"], ["Best Price Guarantee", "More value, always"], ["Flexible Booking", "Cancel with ease"], ["24/7 Support", "We're here for you"]].map(([t, s]) => <div key={t}><b><Check size={14} /> {t}</b>{s}</div>)}</div></div>
      <img src={ph(content.gallery[2]?.image, 4)} alt="" /><div className="q"><div style={{ color: "#e6a935" }}>★★★★★</div>“A wonderful stay from the first moment to the last. The staff, the views and the comfort were exceptional.”<br /><b style={{ display: "block", marginTop: 12 }}>Verified guest</b></div></section>
    <section className="off"><small>LIMITED TIME OFFER</small><h2>{offer?.title || "Save on Your Dream Stay"}</h2><p style={{ maxWidth: 440, fontSize: 14 }}>{offer?.description || "Book direct and enjoy exclusive rates, complimentary breakfast and more special benefits."}</p><Link className="ol" href={href(slug, "/book")}>Book Now →</Link></section>
    <footer><span>© {store.name}</span><span>{store.address}</span></footer>
  </div>;
}

export function ReferenceHotelHome({ layout, ...p }: P & { layout: "aspire" | "larita" | "skyview" }) {
  if (layout === "aspire") return <Aspire {...p} />;
  if (layout === "larita") return <Larita {...p} />;
  return <Skyview {...p} />;
}
