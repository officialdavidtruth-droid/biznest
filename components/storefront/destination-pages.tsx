// Destination guide pages for Wanderly-style travel storefronts: /destinations and /destinations/[slug].
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Compass, Users } from "lucide-react";
import { storeHref as href } from "@/lib/utils/store-href";
import { formatMoney } from "@/lib/utils/format-money";
import { DESTINATION_GUIDES, destinationPhoto, type DestinationGuide } from "@/lib/travel-destinations";
import type { PublicTravelPackage } from "@/lib/travel-public";

type Store = { name: string; logoUrl?: string | null };

const css = `
.dp{--ink:#12334a;--ac:#0b7189;--mut:#6b8191;--line:#e6eef2;font-family:'Plus Jakarta Sans',Inter,system-ui,sans-serif;color:var(--ink);background:#fff;min-height:100vh}
.dp a{color:inherit;text-decoration:none}.dp h1,.dp h2,.dp h3{font-family:'Playfair Display',Georgia,serif;margin:0}
.dp .top{display:flex;align-items:center;justify-content:space-between;padding:20px 5%;border-bottom:1px solid var(--line);background:#fff;position:sticky;top:0;z-index:20}
.dp .logo{display:flex;align-items:center;gap:8px;font:700 22px 'Playfair Display',serif}.dp .logo img{height:30px}
.dp .nav{display:flex;gap:26px;font-size:13px;font-weight:500}.dp .nav a:hover{color:var(--ac)}
.dp .cta{display:inline-flex;gap:8px;align-items:center;background:#0f2a43;color:#fff;padding:13px 24px;border-radius:999px;font-weight:600;font-size:13.5px}
.dp .hero{position:relative;min-height:440px;display:flex;align-items:flex-end;color:#fff;background:#0f2a43 center/cover}
.dp .hero::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,24,38,.15),rgba(8,24,38,.78))}
.dp .hero .in{position:relative;padding:0 5% 48px;max-width:900px}.dp .crumb{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;opacity:.9;margin-bottom:18px}
.dp .hero small{display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;opacity:.9}.dp .hero h1{font-size:clamp(40px,6vw,68px);line-height:1.05;margin:8px 0 12px}.dp .hero p{font-size:17px;line-height:1.6;max-width:560px;margin:0;opacity:.95}
.dp .facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0;margin:-34px 5% 0;position:relative;background:#fff;border-radius:18px;box-shadow:0 12px 40px rgba(18,51,74,.14)}
.dp .fact{display:flex;gap:12px;align-items:flex-start;padding:20px 22px;border-right:1px solid var(--line)}.dp .fact:last-child{border-right:0}
.dp .fact svg{color:var(--ac);flex:none;margin-top:2px}.dp .fact span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);display:block}.dp .fact b{font-size:14px;line-height:1.4;display:block;margin-top:3px}
.dp section.sec{padding:56px 5% 0;max-width:1200px;margin:0 auto}.dp h2{font-size:30px;margin-bottom:6px}.dp .sub{font-size:14px;color:var(--mut);margin:0 0 24px}
.dp .lead{font-size:17px;line-height:1.8;max-width:760px;color:#2a4a60}
.dp .hl{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.dp .hl div{border:1px solid var(--line);border-radius:16px;padding:20px}.dp .hl h3{font-size:18px;margin-bottom:8px}.dp .hl p{margin:0;font-size:13.5px;line-height:1.7;color:var(--mut)}
.dp .tl{list-style:none;margin:0;padding:0;max-width:760px}.dp .tl li{display:flex;gap:18px;padding-bottom:26px;position:relative}.dp .tl li:not(:last-child)::before{content:"";position:absolute;left:41px;top:34px;bottom:2px;width:1px;background:var(--line)}
.dp .tl .d{flex:none;width:84px;height:32px;border-radius:999px;background:rgba(11,113,137,.1);color:var(--ac);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}.dp .tl h3{font-size:17px;margin-bottom:4px}.dp .tl p{margin:0;font-size:13.5px;line-height:1.7;color:var(--mut)}
.dp .tips{background:#f3f9fb;border-radius:18px;padding:26px 28px;max-width:760px}.dp .tips ul{margin:10px 0 0;padding-left:18px;font-size:14px;line-height:1.9;color:#2a4a60}
.dp .pk{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}.dp .pc{border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:8px}.dp .pc h3{font-size:18px}.dp .pc small{color:var(--mut);font-size:12.5px}.dp .pc .pr{font-size:22px;font-weight:700}.dp .pc .pr small{font-size:12px;font-weight:400}.dp .pc .go{margin-top:6px;font-size:13px;font-weight:600;color:var(--ac);display:inline-flex;gap:6px;align-items:center}
.dp .band{margin:64px 5% 0;border-radius:22px;padding:44px;color:#fff;background:linear-gradient(90deg,rgba(15,42,67,.96),rgba(11,113,137,.9));display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between}.dp .band h2{font-size:28px;max-width:520px}.dp .band .cta{background:#fff;color:#0f2a43}
.dp .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}.dp .card{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff;transition:box-shadow .2s,transform .2s}.dp .card:hover{box-shadow:0 14px 34px -16px rgba(18,51,74,.3);transform:translateY(-2px)}
.dp .card img{width:100%;height:190px;object-fit:cover;display:block}.dp .card .b{padding:16px 18px;display:flex;justify-content:space-between;align-items:center;gap:10px}.dp .card b{display:block;font-size:16px}.dp .card small{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}.dp .card .go{width:34px;height:34px;border:1px solid var(--line);border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
.dp .head{padding:56px 5% 8px;max-width:1200px;margin:0 auto}.dp .head h1{font-size:clamp(34px,5vw,52px);margin:8px 0}.dp .head p{color:var(--mut);max-width:560px;line-height:1.7}
.dp footer{margin-top:72px;background:#0f2a43;color:#cfe0ea;padding:30px 5%;font-size:12.5px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}
@media(max-width:800px){.dp .nav{display:none}.dp .fact{border-right:0;border-bottom:1px solid var(--line)}.dp .band{padding:28px}}`;

function Chrome({ store, slug, children }: { store: Store; slug: string; children: React.ReactNode }) {
  return (
    <div className="dp"><style>{css}</style>
      <header className="top">
        <Link href={href(slug, "/")} className="logo">{store.logoUrl && <img src={store.logoUrl} alt={`${store.name} logo`} />}{store.name}</Link>
        <nav className="nav">
          <Link href={href(slug, "/")}>Home</Link><Link href={href(slug, "/destinations")}>Destinations</Link>
          <Link href={href(slug, "/catalog")}>Tours</Link><Link href={href(slug, "/about")}>About</Link><Link href={href(slug, "/contact")}>Contact</Link>
        </nav>
        <Link className="cta" href={href(slug, "/contact")}>Plan your trip</Link>
      </header>
      {children}
      <footer><span>© {new Date().getFullYear()} {store.name}</span><span>Destination guides are for inspiration. Contact us for current availability and pricing.</span></footer>
    </div>
  );
}

function DestinationCard({ slug, g }: { slug: string; g: DestinationGuide }) {
  return (
    <Link href={href(slug, `/destinations/${g.slug}`)} className="card">
      <img src={destinationPhoto(g, 900)} alt={`${g.name}, ${g.region}`} loading="lazy" />
      <div className="b"><span><b>{g.name}</b><small>{g.region}</small></span><i className="go"><ArrowRight size={14} /></i></div>
    </Link>
  );
}

export function DestinationIndex({ store, slug }: { store: Store; slug: string }) {
  return (
    <Chrome store={store} slug={slug}>
      <div className="head">
        <small style={{ fontSize: 11, letterSpacing: ".18em", fontWeight: 600, color: "var(--ac)" }}>DESTINATIONS</small>
        <h1>Where do you want to go?</h1>
        <p>Guides to the places our travellers love most, with the best time to go, what to do and how long to stay.</p>
      </div>
      <section className="sec" style={{ paddingTop: 28 }}>
        <div className="grid">{DESTINATION_GUIDES.map((g) => <DestinationCard key={g.slug} slug={slug} g={g} />)}</div>
      </section>
    </Chrome>
  );
}

export function DestinationDetail({ store, slug, guide, packages }: { store: Store; slug: string; guide: DestinationGuide; packages: PublicTravelPackage[] }) {
  const others = DESTINATION_GUIDES.filter((d) => d.slug !== guide.slug);
  const facts: Array<[React.ReactNode, string, string]> = [
    [<CalendarDays key="a" size={18} />, "Best time to go", guide.bestTime],
    [<Users key="b" size={18} />, "Ideal for", guide.idealFor],
    [<Clock3 key="c" size={18} />, "Suggested stay", guide.suggestedStay],
    [<Compass key="d" size={18} />, "Region", guide.region],
  ];
  return (
    <Chrome store={store} slug={slug}>
      <section className="hero" style={{ backgroundImage: `url(${destinationPhoto(guide)})` }}>
        <div className="in">
          <Link className="crumb" href={href(slug, "/destinations")}><ArrowLeft size={14} /> All destinations</Link>
          <small>{guide.region}</small>
          <h1>{guide.name}</h1>
          <p>{guide.tagline}</p>
        </div>
      </section>

      <div className="facts">{facts.map(([icon, k, v]) => <div className="fact" key={k}>{icon}<div><span>{k}</span><b>{v}</b></div></div>)}</div>

      <section className="sec"><h2>Why go</h2><p className="lead">{guide.overview}</p></section>

      <section className="sec"><h2>Highlights</h2><p className="sub">The experiences worth planning your trip around.</p>
        <div className="hl">{guide.highlights.map((h) => <div key={h.title}><h3>{h.title}</h3><p>{h.body}</p></div>)}</div></section>

      <section className="sec"><h2>A sample itinerary</h2><p className="sub">A starting point. We tailor every trip to your dates and budget.</p>
        <ol className="tl">{guide.itinerary.map((s) => <li key={s.day}><span className="d">{s.day}</span><div><h3>{s.title}</h3><p>{s.body}</p></div></li>)}</ol></section>

      {packages.length > 0 && (
        <section className="sec"><h2>Upcoming {guide.name} tours</h2><p className="sub">Open departures from {store.name}.</p>
          <div className="pk">{packages.map((p) => (
            <div className="pc" key={p.id}>
              <h3>{p.name}</h3><small>{p.durationDays} days{p.departureDate ? ` · departs ${new Date(p.departureDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}</small>
              <div className="pr">{formatMoney(p.pricePerPerson, p.currency)}<small> per person</small></div>
              {p.seatsLeft !== null && <small>{p.seatsLeft === 0 ? "Fully booked" : `${p.seatsLeft} seat${p.seatsLeft === 1 ? "" : "s"} left`}</small>}
              <Link className="go" href={`${href(slug, "/")}#enquire`}>{p.bookable ? "Book this tour" : "Enquire about this tour"} <ArrowRight size={14} /></Link>
            </div>))}</div></section>
      )}

      <section className="sec"><div className="tips"><h2 style={{ fontSize: 22 }}>Good to know</h2><ul>{guide.tips.map((t) => <li key={t}>{t}</li>)}</ul></div></section>

      <div className="band"><h2>Ready to plan your {guide.name} trip?</h2><Link className="cta" href={href(slug, "/contact")}>Talk to {store.name} <ArrowRight size={16} /></Link></div>

      <section className="sec"><h2>More destinations</h2><p className="sub">Keep exploring.</p>
        <div className="grid">{others.map((g) => <DestinationCard key={g.slug} slug={slug} g={g} />)}</div></section>
    </Chrome>
  );
}
