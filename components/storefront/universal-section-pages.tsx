import React from "react";
import { MenuLinks } from "@/components/storefront/store-menu";
import Link from "next/link";
import { ArrowRight, Check, Clock3, Mail, MapPin, Phone, Search, ShieldCheck, Sparkles, BedDouble, CalendarCheck, Camera, Church, Dumbbell, Heart, Package, PartyPopper, Scissors, Truck, UtensilsCrossed, Users, Wrench, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import type { TemplateTheme } from "@/lib/template-themes";
import { resolveBusinessMode } from "@/lib/business-experience";
import { isHotelBusiness } from "@/lib/business-identity";
import { getProfessionalServiceSubNicheByName } from "@/lib/professional-services";
import { NewsletterInlineForm } from "@/components/storefront/newsletter-inline-form";
import { ContactEnquiryForm } from "@/components/storefront/contact-enquiry-form";
import { isCreativeText, nicheFor, resolveServicesListing, servicesNavLink, type Archetype, type NicheIcon, type NicheProfile } from "@/lib/storefront-niche";

const NICHE_ICONS: Record<NicheIcon, LucideIcon> = {
  shield: ShieldCheck, check: Check, clock: Clock3, sparkles: Sparkles, calendar: CalendarCheck, map: MapPin, heart: Heart,
  truck: Truck, wrench: Wrench, scissors: Scissors, bed: BedDouble, utensils: UtensilsCrossed, camera: Camera, party: PartyPopper,
  dumbbell: Dumbbell, users: Users, package: Package, church: Church,
};
function NicheGlyph({name,size}:{name:NicheIcon;size:number}){const I=NICHE_ICONS[name]??ShieldCheck;return <I size={size}/>}

type Item = { id:string; kind:"product"|"service"; name:string; description:string|null; price:number; currency:string; image:string|null; categoryName:string|null; type:string; rentalUnit:string|null; isBookable:boolean; durationMins?:number|null };
type Props = { store:any; slug:string; pageSlug:string; items:Item[]; reviews:any[]; theme:TemplateTheme; social:Record<string,string>; policy?:{title:string;body:string}|null; faq?:{q:string;a:string}[]; pagination?:{page:number;totalPages:number;total:number;pageSize:number} };

const RESERVED = new Set(["services","about","pricing","portfolio","contact","faq","policies"]);
export function isUniversalSectionPage(slug:string){ return RESERVED.has(slug.toLowerCase()); }

export function primaryCta(store:any, slug:string, _theme?:TemplateTheme){
  const category = String(store.business?.category || "").toLowerCase();
  const mode = resolveBusinessMode(store.business?.category, {
    sellsProducts: store.sellsProducts,
    offersServices: store.offersServices,
  });
  if (isHotelBusiness(store.business?.category)) return { label: "Book a Stay", href: `/store/${slug}/catalog` };
  if (category === "restaurant") return { label: "View Menu", href: `/store/${slug}/catalog` };
  if (category === "beauty" || category === "salon" || category === "health" || category.includes("fitness")) return { label: "Book / Enquire", href: `/store/${slug}/services` };
  if (mode === "commerce") return { label: "Shop Now", href: `/store/${slug}/catalog` };
  if (mode === "service" || mode === "hybrid") return { label: "Get a Quote", href: `/store/${slug}/start-project` };
  return { label: "Explore", href: `/store/${slug}` };
}

function secondaryCta(store:any, slug:string){
  const category = String(store.business?.category || "").toLowerCase();
  if (isHotelBusiness(store.business?.category)) return { label: "Explore Rooms", href: `/store/${slug}/catalog` };
  if (category === "restaurant") return { label: "View Menu", href: `/store/${slug}/catalog` };
  if (["fashion", "electronics", "food & groceries", "home & furniture", "agriculture", "real estate"].includes(category)) return { label: "Browse Catalog", href: `/store/${slug}/catalog` };
  return { label: "Explore Services", href: `/store/${slug}/services` };
}

// A CTA that points at the page the visitor is already on is a dead click.
// On /services the primary CTA (e.g. "Book / Enquire") jumps to the service
// list below the hero instead, and a self-pointing secondary CTA is swapped
// for "Contact Us".
export const SERVICES_LIST_ID = "services-list";
function ctasFor(store:any, slug:string, active:string){
  const here = `/store/${slug}/${active}`;
  let primary = primaryCta(store, slug);
  let secondary = secondaryCta(store, slug);
  if (primary.href === here) primary = { ...primary, href: `${here}#${SERVICES_LIST_ID}` };
  if (secondary.href === here) secondary = { label: "Contact Us", href: `/store/${slug}/contact` };
  return { primary, secondary };
}

function modeFor(store:any, theme:TemplateTheme){
  const raw = `${store.business?.category || ""} ${store.business?.businessSubcategory || ""}`;
  return isCreativeText(raw) ? "creative" : "business";
}

// Layout archetype, hero badges, CTA band, headlines and FAQ all come from the
// niche profile in lib/storefront-niche.ts, so every business type reads and
// looks right instead of falling back to a generic corporate page.
function archetypeFor(store:any, theme:TemplateTheme):Archetype{
  return nicheFor(store).archetype;
}
function nicheOf(store:any):NicheProfile{ return nicheFor(store); }

/** The shared call-to-action band. Professional-services niches keep their original per-page copy. */
function Band({store,slug,accent,page,light}:{store:any;slug:string;accent:string;page:"services"|"about"|"portfolio";light?:boolean}){
  const niche=nicheOf(store);
  const legacy=niche.key==="generic"||niche.key.startsWith("pro-");
  const primary=primaryCta(store,slug);
  const href=niche.band.action==="primary"?primary.href:niche.band.action==="contact"?`/store/${slug}/contact`:`/store/${slug}/start-project`;
  const label=niche.band.cta??primary.label;
  const copy=legacy&&page==="about"?{eyebrow:"READY TO WORK TOGETHER?",heading:"Let’s bring your ideas to life.",body:"Tell us what you’re building and our team will help with the next step.",cta:"Get a Quote"}
    :legacy&&page==="portfolio"?{eyebrow:"HAVE A PROJECT IN MIND?",heading:"Let’s bring it to life.",body:"Whether it’s a small request or a larger project, we’re ready to help.",cta:"Get a Quote"}
    :{eyebrow:niche.band.eyebrow,heading:niche.band.heading,body:niche.band.body,cta:label};
  return <section className={`bn-band${light?" light":""}`} style={light?undefined:{background:`linear-gradient(100deg,#061525,${accent})`}}><div><small>{copy.eyebrow}</small><h2>{copy.heading}</h2><p>{copy.body}</p></div><Link href={href} style={light?{background:accent,color:"#fff"}:undefined}>{copy.cta} <ArrowRight size={17}/></Link></section>
}

function text(store:any, mode:"creative"|"business"){
  const category = store.business?.businessSubcategory || store.business?.category || "business";
  const description = store.business?.description || `Professional ${category.toLowerCase()} services designed around quality, reliability and a great customer experience.`;
  if(mode === "creative") return {
    eyebrow:"YOUR IDEAS. OUR EXPERTISE. BIGGER IMPRESSION.",
    about:"More Than a Service, We Build Possibilities",
    services:"Everything You Need in One Place",
    portfolio:"Real Projects. Real Results.",
    pricing:"Quality Solutions for Every Budget.",
    contact:"We’re Here to Help.",
    description,
  };
  return {
    eyebrow:`${String(category).toUpperCase()} / PROFESSIONAL / TRUSTED`,
    about:`Built Around What ${store.name} Does Best`,
    services:"Services Built Around Your Needs",
    portfolio:"Work We’re Proud Of.",
    pricing:"Clear Options. Flexible Solutions.",
    contact:"Let’s Talk About Your Needs.",
    description,
  };
}

/** Header/footer links. The services slot follows the niche (Rooms, Menu, ...) and becomes "Shop" for product-only stores. */
function navLinksFor(store:any):string[][]{
  const niche=nicheOf(store);
  const svc=servicesNavLink(niche,(store.services?.length??0)>0,(store.products?.length??0)>0);
  return [['Home',''],[svc[0],svc[1]],['About','about'],['Portfolio','portfolio'],['Pricing','pricing'],['Contact','contact']];
}

export function Header({store,slug,active,accent,dark=false,radius}:{store:any;slug:string;active:string;accent:string;dark?:boolean;radius?:string}){
 const cta=ctasFor(store,slug,active).primary;
 const links=navLinksFor(store);
 const ink = dark ? "#fff" : "#111";
 const vars = { ...(radius?{"--u-radius":radius}:{}) } as React.CSSProperties;
 return <header className={`bn-universal-header${dark?" dark":""}`} style={vars}><div className="bn-universal-nav">
   <Link href={`/store/${slug}`} className="bn-universal-brand"><span className="bn-universal-logo">{store.logoUrl?<img src={store.logoUrl} alt=""/>:<span>{store.name?.[0] || "B"}</span>}</span><span>{store.name}</span></Link>
   <nav><MenuLinks slug={slug} fallbackNode={<>{links.map(([label,path])=><Link key={label} href={path?`/store/${slug}/${path}`:`/store/${slug}`} className={active===path?"active":""} style={active===path?{"--u-accent":accent} as React.CSSProperties:undefined}>{label}</Link>)}</>}/></nav>
   <div className="bn-universal-actions"><Link href={`/store/${slug}/search`} aria-label="Search"><Search size={20}/></Link><CartLink storeSlug={slug} accent={accent} onAccent={dark?"#111":"#fff"} ink={ink}/><AccountLink storeSlug={slug} ink={ink}/><Link href={cta.href} className="bn-universal-quote" style={{background:accent}}>{cta.label} <ArrowRight size={15}/></Link></div>
 </div></header>
}

function Footer({store,slug,accent}:{store:any;slug:string;accent:string}){
 return <footer className="bn-universal-footer"><div className="bn-universal-footer-grid"><div><div className="bn-universal-footer-brand"><span className="bn-universal-logo">{store.logoUrl?<img src={store.logoUrl} alt=""/>:<span>{store.name?.[0] || "B"}</span>}</span><strong>{store.name}</strong></div><p>{store.business?.description || "Professional solutions for people and businesses."}</p><div className="bn-footer-social">{Object.entries((store.socialLinks||{}) as Record<string,string>).slice(0,5).map(([k,v])=>v?<a key={k} href={String(v)} target="_blank" rel="noreferrer">{k.slice(0,2).toUpperCase()}</a>:null)}</div></div>
 <div><h4>Quick Links</h4>{navLinksFor(store).map(([l,p])=><Link key={l} href={`/store/${slug}${p?`/${p}`:''}`}>{l}</Link>)}</div>
 <div><h4>Contact Us</h4>{store.contactPhone&&<a href={`tel:${store.contactPhone}`}><Phone size={14}/>{store.contactPhone}</a>}{store.contactEmail&&<a href={`mailto:${store.contactEmail}`}><Mail size={14}/>{store.contactEmail}</a>}<span><MapPin size={14}/>{[store.business?.city,store.business?.state,store.business?.country].filter(Boolean).join(", ") || "Online business"}</span></div>
 <div><h4>Stay Updated</h4><p>Get the latest updates, offers and useful information.</p><NewsletterInlineForm slug={slug} className="bn-newsletter" buttonStyle={{background:accent}}><ArrowRight size={16}/></NewsletterInlineForm></div></div><div className="bn-universal-copyright"><span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span><span>Privacy Policy &nbsp; Terms of Service</span></div></footer>
}

function Hero({store,slug,active,copy,accent,hero,archetype="editorial",children}:{store:any;slug:string;active:string;copy:any;accent:string;hero:string|null;archetype?:Archetype;children:React.ReactNode}){
 const {primary,secondary}=ctasFor(store,slug,active);
 const niche=nicheOf(store);
 const badges=niche.trust;
 if(archetype==="corporate"){
  return <section className="bn-universal-hero corporate"><div className="bn-universal-hero-inner corporate"><div className="bn-universal-eyebrow center"><NicheGlyph name={badges[0].icon} size={13}/> {copy.eyebrow}</div><h1>{children}</h1><p>{copy.description}</p><div className="bn-universal-hero-actions center"><Link href={primary.href} className="bn-primary" style={{background:accent}}>{primary.label} <ArrowRight size={16}/></Link><Link href={secondary.href} className="bn-secondary corporate">{secondary.label} <ArrowRight size={16}/></Link></div><div className="bn-hero-trust corporate">{badges.map(b=><span key={b.label}><NicheGlyph name={b.icon} size={18}/>{b.label}</span>)}</div></div></section>
 }
 if(archetype==="technical"){
  return <section className="bn-universal-hero technical"><div className="bn-universal-hero-inner"><div className="bn-universal-eyebrow mono">&gt; {copy.eyebrow}</div><h1>{children}</h1><p>{copy.description}</p><div className="bn-universal-hero-actions"><Link href={primary.href} className="bn-primary square" style={{background:accent}}>{primary.label} <ArrowRight size={16}/></Link><Link href={secondary.href} className="bn-secondary square">{secondary.label} <ArrowRight size={16}/></Link></div><div className="bn-hero-trust mono">{badges.map(b=><span key={b.label}>// {b.label}</span>)}</div></div></section>
 }
 return <section className="bn-universal-hero" style={hero?{backgroundImage:`linear-gradient(90deg,rgba(4,13,23,.94) 0%,rgba(4,13,23,.76) 46%,rgba(4,13,23,.22) 100%),url(${hero})`}:{backgroundImage:"radial-gradient(circle at 78% 42%,rgba(20,115,234,.34),transparent 28%),linear-gradient(135deg,#061525 0%,#071522 52%,#102b46 100%)"}}><div className={`bn-universal-hero-inner${archetype==="built"?" built":""}`}><div className="bn-universal-eyebrow">{copy.eyebrow}</div><h1>{children}</h1><p>{copy.description}</p><div className="bn-universal-hero-actions"><Link href={primary.href} className="bn-primary" style={{background:accent}}>{primary.label} <ArrowRight size={16}/></Link><Link href={secondary.href} className="bn-secondary">{secondary.label} <ArrowRight size={16}/></Link></div><div className="bn-hero-trust">{badges.map(b=><span key={b.label}><NicheGlyph name={b.icon} size={20}/>{b.label}</span>)}</div></div></section>
}

function SectionTitle({eyebrow,title,sub}:{eyebrow:string;title:string;sub?:string}){return <div className="bn-universal-section-title"><small>{eyebrow}</small><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>}
function imageStyle(url:string|null,fallback:string):React.CSSProperties{return url?{backgroundImage:`url(${url})`,backgroundSize:"cover",backgroundPosition:"center"}:{background:fallback}}

function formatPrice(x:Item){return x.price>0?`${x.currency} ${x.price.toLocaleString()}`:null}
function formatDuration(m?:number|null){if(!m||m<=0)return null;if(m<60)return `${m} min`;const h=Math.floor(m/60),r=m%60;return r?`${h}h ${r}m`:`${h}h`}
function ServiceMeta({x,accent}:{x:Item;accent:string}){const price=formatPrice(x),dur=formatDuration(x.durationMins);if(!price&&!dur)return null;return <div className="bn-service-meta">{price&&<b style={{color:accent}}>{price}</b>}{dur&&<span><Clock3 size={12}/>{dur}</span>}</div>}
function BookButton({x,href,accent,square}:{x:Item;href:string;accent:string;square?:boolean}){if(!(x.kind==="service"&&x.isBookable))return null;return <Link href={href} className={`bn-book-btn${square?" square":""}`} style={{background:accent}}>Book now <ArrowRight size={13}/></Link>}
function ServiceCard({x,i,accent,slug,archetype,icon}:{x:Item;i:number;accent:string;slug:string;archetype:Archetype;icon:NicheIcon}){
 const href=`/store/${slug}/${x.kind}/${x.id}`;
 // Cards are <article>s with a details link plus a separate Book link: a Book
 // <a> can't be nested inside a card-wide <a>.
 if(archetype==="corporate") return <article className="bn-service-row"><Link href={href} className="bn-service-row-main">{x.image?<span className="bn-service-row-thumb" style={imageStyle(x.image,"#e7edf4")}/>:<span className="bn-service-row-icon" style={{background:`${accent}18`,color:accent}}><NicheGlyph name={icon} size={19}/></span>}<div><small>{x.categoryName||x.kind}</small><h3>{x.name}</h3><p>{x.description||"Professional service tailored to your requirements."}</p><ServiceMeta x={x} accent={accent}/></div></Link><div className="bn-service-row-side"><BookButton x={x} href={href} accent={accent}/><Link href={href} className="bn-service-row-arrow" aria-label={`View ${x.name}`}><ArrowRight size={17}/></Link></div></article>;
 if(archetype==="technical") return <article className="bn-service-tech-card"><Link href={href} className="bn-service-tech-main">{x.image&&<span className="bn-service-tech-img" style={imageStyle(x.image,"#111a28")}/>}<span className="bn-service-tech-index" style={{color:accent}}>{String(i+1).padStart(2,"0")}</span><h3>{x.name}</h3><p>{x.description||"Engineered to spec, delivered on time."}</p><ServiceMeta x={x} accent={accent}/></Link><div className="bn-service-tech-foot"><Link href={href} className="bn-service-tech-more" style={{color:accent}}>View details <ArrowRight size={13}/></Link><BookButton x={x} href={href} accent={accent} square/></div></article>;
 return <article className="bn-service-card"><Link href={href} className="bn-service-card-main"><div className="bn-service-image" style={imageStyle(x.image,`${accent}${i%2?"16":"28"}`)}></div><div className="bn-service-body"><small>{x.categoryName||x.kind}</small><h3>{x.name}</h3><p>{x.description||"Professional service tailored to your requirements."}</p><ServiceMeta x={x} accent={accent}/></div></Link><div className="bn-service-card-foot"><Link href={href} className="bn-service-learn">Learn More <ArrowRight size={15}/></Link><BookButton x={x} href={href} accent={accent}/></div></article>;
}
function Pager({slug,pagination,accent}:{slug:string;pagination?:Props["pagination"];accent:string}){
 if(!pagination||pagination.totalPages<=1)return null;
 const {page,totalPages,total}=pagination;
 const href=(n:number)=>n<=1?`/store/${slug}/services`:`/store/${slug}/services?page=${n}`;
 const nums=Array.from({length:totalPages},(_,k)=>k+1).filter(n=>n===1||n===totalPages||Math.abs(n-page)<=1);
 return <nav className="bn-pager" aria-label="Services pagination"><p>Page {page} of {totalPages} · {total} services</p><div>{page>1&&<Link href={href(page-1)} rel="prev">← Previous</Link>}{nums.map((n,k)=><React.Fragment key={n}>{k>0&&n-nums[k-1]>1&&<span className="bn-pager-gap">…</span>}<Link href={href(n)} aria-current={n===page?"page":undefined} className={n===page?"active":undefined} style={n===page?{background:accent,borderColor:accent,color:"#fff"}:undefined}>{n}</Link></React.Fragment>)}{page<totalPages&&<Link href={href(page+1)} rel="next">Next →</Link>}</div></nav>
}
function WorkCard({x,accent,slug,archetype}:{x:Item;accent:string;slug:string;archetype:Archetype}){
 const href=`/store/${slug}/${x.kind}/${x.id}`;
 if(archetype==="technical") return <Link href={href} className="bn-portfolio-tech-card"><div className="bn-portfolio-tech-top" style={{borderColor:accent}}><span style={{color:accent}}>{x.categoryName||x.kind}</span></div><h3>{x.name}</h3><p>View case study <ArrowRight size={13}/></p></Link>;
 return <Link href={href} className="bn-portfolio-card"><div className="bn-portfolio-image" style={imageStyle(x.image,"#e7edf4")}></div><h3>{x.name}</h3><p>{x.categoryName||x.kind}</p></Link>;
}
function PriceCard({x,i,accent,slug,archetype,cta}:{x:Item;i:number;accent:string;slug:string;archetype:Archetype;cta:{label:string;href:string}}){
 const price=x.price?`${x.currency} ${x.price.toLocaleString()}`:"Custom Quote";
 if(archetype==="corporate") return <article className={`bn-price-row ${i===1?"featured":""}`} key={x.id}>{i===1&&<span className="bn-popular" style={{background:accent}}>Popular</span>}<small>{x.categoryName||"Solution"}</small><h3>{x.name}</h3><p>{x.description||"Professional quality, delivered to your requirements."}</p><div className="bn-price" style={{color:accent}}>{price}</div><Link href={cta.href} style={{background:accent}} className="bn-primary">{cta.label} <ArrowRight size={15}/></Link></article>;
 if(archetype==="technical") return <article className={`bn-price-tech-card ${i===1?"featured":""}`} key={x.id} style={i===1?{borderColor:accent}:undefined}><small style={{color:accent}}>{x.categoryName||"Plan"}</small><h3>{x.name}</h3><div className="bn-price mono">{price}</div><p>{x.description||"Built to spec, deployed fast."}</p><Link href={cta.href} className="bn-primary square" style={{background:accent}}>{cta.label} <ArrowRight size={15}/></Link></article>;
 return <article className={`bn-price-card ${i===1?"featured":""}`} key={x.id}>{i===1&&<span className="bn-popular" style={{background:accent}}>Popular</span>}<div className="bn-price-image" style={imageStyle(x.image,`${accent}${i%2?"22":"12"}`)}></div><div className="bn-price-body"><small>{x.categoryName||"Solution"}</small><h3>{x.name}</h3><p>{x.description||"Professional quality, delivered to your requirements."}</p><div className="bn-price">{price}</div>{x.price>0&&<small>Starting price</small>}<Link href={cta.href} style={{borderColor:accent,color:accent}}>{cta.label} <ArrowRight size={15}/></Link></div></article>;
}

function priceCtaFor(store:any,slug:string,niche:NicheProfile){
 if(niche.band.action==="primary") return primaryCta(store,slug);
 if(niche.band.action==="contact") return {label:"Enquire Now",href:`/store/${slug}/contact`};
 return {label:"Get a Quote",href:`/store/${slug}/start-project`};
}
function Services({p}:{p:Props}){
 const {store,slug,items,theme}=p;const accent=theme.accent;const niche=nicheOf(store);const archetype=niche.archetype;
 const services=items.filter(x=>x.kind==="service");const products=items.filter(x=>x.kind==="product");
 // Services are listed first. Products only appear here for niches whose page is
 // really a product list (restaurant menu); a product-only store goes to its catalog.
 const listing=resolveServicesListing(niche,services,products);
 if(listing.mode==="redirect-to-catalog") redirect(`/store/${slug}/catalog`);
 const list=listing.mode==="list"?listing.items:[];
 const heroImg=(archetype==="corporate"||archetype==="technical")?null:(store.bannerUrl||store.storyImage||items.find(x=>x.image)?.image||null);
 const copy=text(store,modeFor(store,theme));
 return <><Header store={store} slug={slug} active="services" accent={accent}/><Hero store={store} slug={slug} active="services" archetype={archetype} copy={copy} accent={accent} hero={heroImg}><>{niche.servicesHero[0]}<br/><span style={{color:accent}}>{niche.servicesHero[1]}</span></></Hero><main className="bn-universal-main"><section id={SERVICES_LIST_ID} className="bn-universal-section"><SectionTitle eyebrow={niche.servicesEyebrow} title={copy.services} sub={niche.servicesSub}/><div className={`bn-service-grid ${archetype}`}>{list.length?list.map((x,i)=><ServiceCard key={x.id} x={x} i={i+((p.pagination?.page??1)-1)*(p.pagination?.pageSize??0)} accent={accent} slug={slug} archetype={archetype} icon={niche.trust[0].icon}/>):<div className="bn-empty"><b>{niche.emptyServices.title}</b><p>{niche.emptyServices.body}</p></div>}</div><Pager slug={slug} pagination={p.pagination} accent={accent}/></section><Band store={store} slug={slug} accent={accent} page="services"/></main><Footer store={store} slug={slug} accent={accent}/></>}

function About({p}:{p:Props}){const {store,slug,items,theme}=p;const copy=text(store,modeFor(store,theme));const accent=theme.accent;const archetype=archetypeFor(store,theme);const image=store.storyImage||store.bannerUrl||items.find(x=>x.image)?.image||null;const heroImg=(archetype==="corporate"||archetype==="technical")?null:image;return <><Header store={store} slug={slug} active="about" accent={accent}/><Hero store={store} slug={slug} active="about" archetype={archetype} copy={copy} accent={accent} hero={heroImg}><>{nicheOf(store).aboutHero[0]}<br/><span style={{color:accent}}>{nicheOf(store).aboutHero[1]}</span></></Hero><main className="bn-universal-main"><section className="bn-about-intro bn-universal-section"><div><small>WHO WE ARE</small><h2>{copy.about}</h2><p>{copy.description}</p><p>We combine expertise, technology and attention to detail to deliver work that makes a lasting impression.</p><Link href={`/store/${slug}/services`} className="bn-primary" style={{background:accent}}>Explore Our Services <ArrowRight size={16}/></Link></div><div className="bn-about-image" style={imageStyle(image,"linear-gradient(135deg,#dfe8f2,#8ea6bb)")}></div></section><section className="bn-values"><SectionTitle eyebrow="OUR MISSION, VISION & VALUES" title="What Drives Us"/><div className="bn-values-grid">{[["Our Mission","Deliver dependable, high-quality solutions that help customers move forward."],["Our Vision","Become the trusted choice in our field through quality, creativity and consistency."],["Our Values","Quality in everything we do, customer satisfaction, integrity and continuous improvement."]].map(([t,b])=><article key={t}><div className="bn-value-icon" style={{color:accent}}><Sparkles size={22}/></div><h3>{t}</h3><p>{b}</p><div className="bn-check"><Check size={15}/> Customer focused</div><div className="bn-check"><Check size={15}/> Professional delivery</div></article>)}</div></section><Band store={store} slug={slug} accent={accent} page="about"/></main><Footer store={store} slug={slug} accent={accent}/></>}

function Portfolio({p}:{p:Props}){const {store,slug,items,theme}=p;const copy=text(store,modeFor(store,theme));const accent=theme.accent;const archetype=archetypeFor(store,theme);const work=items.filter(x=>x.image).slice(0,15);const heroImg=archetype==="technical"?null:(store.bannerUrl||work[0]?.image||null);return <><Header store={store} slug={slug} active="portfolio" accent={accent}/><Hero store={store} slug={slug} active="portfolio" archetype={archetype} copy={copy} accent={accent} hero={heroImg}><>Real Projects.<br/><span style={{color:accent}}>Real Results.</span></></Hero><main className="bn-universal-main"><section className="bn-universal-section"><SectionTitle eyebrow="OUR WORK" title="Featured Projects" sub="Explore examples of the products, services and projects this business delivers."/><div className={`bn-portfolio-grid ${archetype}`}>{work.length?work.map(x=><WorkCard key={x.id} x={x} accent={accent} slug={slug} archetype={archetype}/>):<div className="bn-empty">Add published products or services with images to populate this portfolio.</div>}</div></section><Band store={store} slug={slug} accent={accent} page="portfolio" light/></main><Footer store={store} slug={slug} accent={accent}/></>}

function Pricing({p}:{p:Props}){const {store,slug,items,theme}=p;const accent=theme.accent;const niche=nicheOf(store);const archetype=archetypeFor(store,theme);const copy=text(store,modeFor(store,theme));const list=items.filter(x=>x.price>0).slice(0,8);const heroImg=(archetype==="corporate"||archetype==="technical")?null:(store.bannerUrl||items.find(x=>x.image)?.image||null);const priceItems=(list.length?list:[{id:"empty",kind:"service",name:"Custom Project",description:"Tell us what you need and we’ll prepare a tailored quote.",price:0,currency:"",image:null,categoryName:null,type:"SERVICE",rentalUnit:null,isBookable:false} as Item]);return <><Header store={store} slug={slug} active="pricing" accent={accent}/><Hero store={store} slug={slug} active="pricing" archetype={archetype} copy={copy} accent={accent} hero={heroImg}><>Our Pricing<br/><span style={{color:accent}}>Quality for Every Budget.</span></></Hero><main className="bn-universal-main"><section className="bn-universal-section"><SectionTitle eyebrow="OUR PRICING" title="Simple, transparent options" sub="Starting prices are shown where available. For custom requirements, request a quote and we’ll recommend the best option."/><div className={`bn-price-grid ${archetype}`}>{priceItems.map((x,i)=><PriceCard key={x.id} x={x} i={i} accent={accent} slug={slug} archetype={archetype} cta={priceCtaFor(store,slug,niche)}/>)}</div></section><section className="bn-pricing-strip"><div><small>{niche.pricingStrip.eyebrow}</small><h2>{niche.pricingStrip.heading}</h2><p>{niche.pricingStrip.body}</p></div><Link href={niche.band.action==="quote"?`/store/${slug}/start-project`:`/store/${slug}/contact`} style={{background:accent}}>{niche.pricingStrip.cta} <ArrowRight size={16}/></Link></section><section className="bn-faq bn-universal-section"><SectionTitle eyebrow="FREQUENTLY ASKED QUESTIONS" title="Quick Answers"/><div className="bn-faq-grid">{niche.faq.map(q=><details key={q}><summary>{q}<ArrowRight size={15}/></summary><p>Contact {store.name} with your requirements and the team will confirm the most suitable option, timing and final price.</p></details>)}</div></section></main><Footer store={store} slug={slug} accent={accent}/></>}

function Contact({p}:{p:Props}){const {store,slug,theme}=p;const accent=theme.accent;const archetype=archetypeFor(store,theme);const copy=text(store,modeFor(store,theme));const city=[store.business?.city,store.business?.state,store.business?.country].filter(Boolean).join(", ");const heroImg=(archetype==="corporate"||archetype==="technical")?null:(store.bannerUrl||null);return <><Header store={store} slug={slug} active="contact" accent={accent}/><Hero store={store} slug={slug} active="contact" archetype={archetype} copy={copy} accent={accent} hero={heroImg}><>We’re Here<br/><span style={{color:accent}}>to Help.</span></></Hero><main className="bn-universal-main"><section className="bn-contact-grid bn-universal-section"><ContactEnquiryForm slug={slug} accent={accent} phonePlaceholder={store.contactPhone||undefined} subjects={["General enquiry",nicheOf(store).band.action==="quote"?"Request a quote":"Booking / availability",nicheOf(store).servicesLabel]}/><aside className="bn-contact-side"><div><h3>Contact Information</h3><p>Reach us through any of the channels below. We’d love to hear from you.</p>{store.contactPhone&&<a href={`tel:${store.contactPhone}`}><span style={{background:accent}}><Phone size={19}/></span><div><b>Call Us</b><small>{store.contactPhone}</small></div></a>}{store.contactEmail&&<a href={`mailto:${store.contactEmail}`}><span style={{background:accent}}><Mail size={19}/></span><div><b>Email Us</b><small>{store.contactEmail}</small></div></a>}<div><span style={{background:accent}}><MapPin size={19}/></span><div><b>Visit / Location</b><small>{city||"Contact us for location details."}</small></div></div></div><div className="bn-hours"><h3>Business Information</h3><div><span>Availability</span><b>Open for enquiries</b></div><div><span>Response time</span><b>Usually within 1 business day</b></div></div></aside></section><section className="bn-location" style={{backgroundImage:`linear-gradient(120deg,${accent}12,#eaf1f8)`}}><MapPin size={28} style={{color:accent}}/><div><small>OUR LOCATION</small><h2>{city||"Serving customers wherever they are"}</h2><p>{store.contactPhone||store.contactEmail||"Contact us to arrange a visit or consultation."}</p></div></section><section className="bn-band" style={{background:`linear-gradient(100deg,#061525,${accent})`}}><div><small>HAVE A LARGE PROJECT?</small><h2>Let’s discuss it.</h2><p>Special arrangements are available for larger, recurring or corporate work.</p></div><Link href={`/store/${slug}/start-project`}>Request a Quote <ArrowRight size={17}/></Link></section></main><Footer store={store} slug={slug} accent={accent}/></>}


function Faq({p}:{p:Props}){const {store,slug}=p;return <><Header store={store} slug={slug} active="faq" accent={p.theme.accent}/><main className="bn-universal-main"><section className="bn-universal-section"><div className="bn-universal-eyebrow">FREQUENTLY ASKED QUESTIONS</div><h1>How can we help?</h1>{(p.faq?.length??0)>0
  ? <div className="bn-faq-grid">{p.faq!.map(x=><details key={x.q}><summary>{x.q}<ArrowRight size={15}/></summary><p style={{whiteSpace:"pre-line"}}>{x.a}</p></details>)}</div>
  : <p>{store.name} hasn&apos;t published its FAQ yet. <Link href={`/store/${slug}/contact`}>Contact the store</Link> and they will answer directly.</p>}</section></main><Footer store={store} slug={slug} accent={p.theme.accent}/></>}
function Policies({p}:{p:Props}){
 const {store,slug,policy}=p;
 const paragraphs=(policy?.body??"").split(/\n{2,}/).map((x)=>x.trim()).filter(Boolean);
 return <><Header store={store} slug={slug} active="policies" accent={p.theme.accent}/><main className="bn-universal-main"><section className="bn-universal-section"><div className="bn-universal-eyebrow">LEGAL</div>
 {paragraphs.length>0
  ? <><h1>{policy?.title||"Policies"}</h1>{paragraphs.map((t,i)=><p key={i} style={{whiteSpace:"pre-line"}}>{t}</p>)}</>
  : <><h1>Terms &amp; Policies</h1><p>{store.name} hasn&apos;t published its terms, privacy or refund policy yet. Please contact the store directly before placing an order. <Link href={`/store/${slug}/contact`}>Contact the store</Link></p></>}
 </section></main><Footer store={store} slug={slug} accent={p.theme.accent}/></>}

export function UniversalSectionPage(p:Props){
 const normalized=p;
 switch(p.pageSlug.toLowerCase()){case"services":return <Services p={normalized}/>;case"about":return <About p={normalized}/>;case"portfolio":return <Portfolio p={normalized}/>;case"pricing":return <Pricing p={normalized}/>;case"contact":return <Contact p={normalized}/>;case"faq":return <Faq p={normalized}/>;case"policies":return <Policies p={normalized}/>;default:return null;}
}