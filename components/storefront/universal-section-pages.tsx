import React from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock3, Mail, MapPin, Phone, Search, ShieldCheck, Sparkles } from "lucide-react";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import type { TemplateTheme } from "@/lib/template-themes";
import { resolveBusinessMode } from "@/lib/business-experience";

type Item = { id:string; kind:"product"|"service"; name:string; description:string|null; price:number; currency:string; image:string|null; categoryName:string|null; type:string; rentalUnit:string|null; isBookable:boolean };
type Props = { store:any; slug:string; pageSlug:string; items:Item[]; reviews:any[]; theme:TemplateTheme; social:Record<string,string> };

const RESERVED = new Set(["services","about","pricing","portfolio","contact"]);
export function isUniversalSectionPage(slug:string){ return RESERVED.has(slug.toLowerCase()); }

export function primaryCta(store:any, slug:string, _theme?:TemplateTheme){
  const category = String(store.business?.category || "").toLowerCase();
  const mode = resolveBusinessMode(store.business?.category, {
    sellsProducts: store.sellsProducts,
    offersServices: store.offersServices,
  });
  if (category.includes("hotel") || category.includes("lodging")) return { label: "Book a Stay", href: `/store/${slug}/hotel/rooms` };
  if (category === "restaurant") return { label: "View Menu", href: `/store/${slug}/catalog` };
  if (category === "beauty" || category === "salon" || category === "health" || category.includes("fitness")) return { label: "Book / Enquire", href: `/store/${slug}/services` };
  if (mode === "commerce") return { label: "Shop Now", href: `/store/${slug}/catalog` };
  if (mode === "service" || mode === "hybrid") return { label: "Get a Quote", href: `/store/${slug}/start-project` };
  return { label: "Explore", href: `/store/${slug}` };
}

function secondaryCta(store:any, slug:string){
  const category = String(store.business?.category || "").toLowerCase();
  if (category.includes("hotel") || category.includes("lodging")) return { label: "Explore Rooms", href: `/store/${slug}/hotel/rooms` };
  if (category === "restaurant") return { label: "View Menu", href: `/store/${slug}/catalog` };
  if (["fashion", "electronics", "food & groceries", "home & furniture", "agriculture", "real estate"].includes(category)) return { label: "Browse Catalog", href: `/store/${slug}/catalog` };
  return { label: "Explore Services", href: `/store/${slug}/services` };
}

function modeFor(store:any, theme:TemplateTheme){
  const raw = `${theme.professionalMode || ""} ${store.business?.category || ""} ${store.business?.businessSubcategory || ""}`.toLowerCase();
  return raw.includes("print") || raw.includes("graphic") || raw.includes("brand") || raw.includes("marketing") || raw.includes("creative") || raw.includes("photograph")
    ? "creative" : "business";
}

// Groups the 13 professional-service catalog entries (plus any other store)
// into 4 visual archetypes so /services, /about, /portfolio, /pricing and
// /contact read differently per industry while sharing the same header,
// footer, colors and corner radius.
type Archetype = "editorial"|"corporate"|"technical"|"built";
function archetypeFor(store:any, theme:TemplateTheme):Archetype{
  const pm = theme.professionalMode;
  if (pm === "web-development" || pm === "it-services") return "technical";
  if (pm === "architecture" || pm === "engineering" || pm === "construction-company") return "built";
  if (pm === "graphic-design" || pm === "branding-agency" || pm === "marketing-agency" || pm === "photography-studio") return "editorial";
  if (pm === "legal" || pm === "accounting" || pm === "hr-recruitment" || pm === "consulting") return "corporate";
  // Non professional-services stores (retail templates etc.) fall back to the old creative/business heuristic.
  return modeFor(store, theme) === "creative" ? "editorial" : "corporate";
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

export function Header({store,slug,active,accent,dark=false,radius}:{store:any;slug:string;active:string;accent:string;dark?:boolean;radius?:string}){
 const cta=primaryCta(store,slug,{accent} as TemplateTheme);
 const links=[['Home',''],['Services','services'],['About','about'],['Portfolio','portfolio'],['Pricing','pricing'],['Contact','contact']];
 const ink = dark ? "#fff" : "#111";
 const vars = { ...(radius?{"--u-radius":radius}:{}) } as React.CSSProperties;
 return <header className={`bn-universal-header${dark?" dark":""}`} style={vars}><div className="bn-universal-nav">
   <Link href={`/store/${slug}`} className="bn-universal-brand"><span className="bn-universal-logo">{store.logoUrl?<img src={store.logoUrl} alt=""/>:<span>{store.name?.[0] || "B"}</span>}</span><span>{store.name}</span></Link>
   <nav>{links.map(([label,path])=><Link key={label} href={path?`/store/${slug}/${path}`:`/store/${slug}`} className={active===path?"active":""} style={active===path?{"--u-accent":accent} as React.CSSProperties:undefined}>{label}</Link>)}</nav>
   <div className="bn-universal-actions"><Link href={`/store/${slug}/search`} aria-label="Search"><Search size={20}/></Link><CartLink storeSlug={slug} accent={accent} onAccent={dark?"#111":"#fff"} ink={ink}/><AccountLink storeSlug={slug} ink={ink}/><Link href={cta.href} className="bn-universal-quote" style={{background:accent}}>{cta.label} <ArrowRight size={15}/></Link></div>
 </div></header>
}

function Footer({store,slug,accent}:{store:any;slug:string;accent:string}){
 return <footer className="bn-universal-footer"><div className="bn-universal-footer-grid"><div><div className="bn-universal-footer-brand"><span className="bn-universal-logo">{store.logoUrl?<img src={store.logoUrl} alt=""/>:<span>{store.name?.[0] || "B"}</span>}</span><strong>{store.name}</strong></div><p>{store.business?.description || "Professional solutions for people and businesses."}</p><div className="bn-footer-social">{Object.entries((store.socialLinks||{}) as Record<string,string>).slice(0,5).map(([k,v])=>v?<a key={k} href={String(v)} target="_blank" rel="noreferrer">{k.slice(0,2).toUpperCase()}</a>:null)}</div></div>
 <div><h4>Quick Links</h4>{[['Home',''],['Services','services'],['About','about'],['Portfolio','portfolio'],['Pricing','pricing'],['Contact','contact']].map(([l,p])=><Link key={l} href={`/store/${slug}${p?`/${p}`:''}`}>{l}</Link>)}</div>
 <div><h4>Contact Us</h4>{store.contactPhone&&<a href={`tel:${store.contactPhone}`}><Phone size={14}/>{store.contactPhone}</a>}{store.contactEmail&&<a href={`mailto:${store.contactEmail}`}><Mail size={14}/>{store.contactEmail}</a>}<span><MapPin size={14}/>{[store.business?.city,store.business?.state,store.business?.country].filter(Boolean).join(", ") || "Online business"}</span></div>
 <div><h4>Stay Updated</h4><p>Get the latest updates, offers and useful information.</p><div className="bn-newsletter"><input placeholder="Your email address"/><button style={{background:accent}}><ArrowRight size={16}/></button></div></div></div><div className="bn-universal-copyright"><span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span><span>Privacy Policy &nbsp; Terms of Service</span></div></footer>
}

function Hero({store,slug,active,copy,accent,hero,archetype="editorial",children}:{store:any;slug:string;active:string;copy:any;accent:string;hero:string|null;archetype?:Archetype;children:React.ReactNode}){
 const primary=primaryCta(store,slug); const secondary=secondaryCta(store,slug);
 if(archetype==="corporate"){
  return <section className="bn-universal-hero corporate"><div className="bn-universal-hero-inner corporate"><div className="bn-universal-eyebrow center"><ShieldCheck size={13}/> {copy.eyebrow}</div><h1>{children}</h1><p>{copy.description}</p><div className="bn-universal-hero-actions center"><Link href={primary.href} className="bn-primary" style={{background:accent}}>{primary.label} <ArrowRight size={16}/></Link><Link href={secondary.href} className="bn-secondary corporate">{secondary.label} <ArrowRight size={16}/></Link></div><div className="bn-hero-trust corporate"><span><ShieldCheck size={18}/>Licensed &amp; Insured</span><span><Check size={18}/>Client-First Approach</span><span><Clock3 size={18}/>Responsive Support</span></div></div></section>
 }
 if(archetype==="technical"){
  return <section className="bn-universal-hero technical"><div className="bn-universal-hero-inner"><div className="bn-universal-eyebrow mono">&gt; {copy.eyebrow}</div><h1>{children}</h1><p>{copy.description}</p><div className="bn-universal-hero-actions"><Link href={primary.href} className="bn-primary square" style={{background:accent}}>{primary.label} <ArrowRight size={16}/></Link><Link href={secondary.href} className="bn-secondary square">{secondary.label} <ArrowRight size={16}/></Link></div><div className="bn-hero-trust mono"><span>// 99.9% Uptime</span><span>// 24/7 Support</span><span>// Secure by Design</span></div></div></section>
 }
 return <section className="bn-universal-hero" style={hero?{backgroundImage:`linear-gradient(90deg,rgba(4,13,23,.94) 0%,rgba(4,13,23,.76) 46%,rgba(4,13,23,.22) 100%),url(${hero})`}:{backgroundImage:"radial-gradient(circle at 78% 42%,rgba(20,115,234,.34),transparent 28%),linear-gradient(135deg,#061525 0%,#071522 52%,#102b46 100%)"}}><div className={`bn-universal-hero-inner${archetype==="built"?" built":""}`}><div className="bn-universal-eyebrow">{copy.eyebrow}</div><h1>{children}</h1><p>{copy.description}</p><div className="bn-universal-hero-actions"><Link href={primary.href} className="bn-primary" style={{background:accent}}>{primary.label} <ArrowRight size={16}/></Link><Link href={secondary.href} className="bn-secondary">{secondary.label} <ArrowRight size={16}/></Link></div><div className="bn-hero-trust">{archetype==="built"?<><span><ShieldCheck size={20}/>Licensed Crews</span><span><Clock3 size={20}/>On-Schedule Delivery</span><span><Sparkles size={20}/>Built to Spec</span></>:<><span><ShieldCheck size={20}/>Quality Service</span><span><Clock3 size={20}/>Fast Response</span><span><Sparkles size={20}/>Professional Results</span></>}</div></div></section>
}

function SectionTitle({eyebrow,title,sub}:{eyebrow:string;title:string;sub?:string}){return <div className="bn-universal-section-title"><small>{eyebrow}</small><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>}
function imageStyle(url:string|null,fallback:string):React.CSSProperties{return url?{backgroundImage:`url(${url})`,backgroundSize:"cover",backgroundPosition:"center"}:{background:fallback}}

function ServiceCard({x,i,accent,slug,archetype}:{x:Item;i:number;accent:string;slug:string;archetype:Archetype}){
 const href=`/store/${slug}/${x.kind}/${x.id}`;
 if(archetype==="corporate") return <Link href={href} className="bn-service-row"><span className="bn-service-row-icon" style={{background:`${accent}18`,color:accent}}><ShieldCheck size={19}/></span><div><small>{x.categoryName||x.kind}</small><h3>{x.name}</h3><p>{x.description||"Professional service tailored to your requirements."}</p></div><ArrowRight size={17} className="bn-service-row-arrow"/></Link>;
 if(archetype==="technical") return <Link href={href} className="bn-service-tech-card"><span className="bn-service-tech-index" style={{color:accent}}>{String(i+1).padStart(2,"0")}</span><h3>{x.name}</h3><p>{x.description||"Engineered to spec, delivered on time."}</p><span className="bn-service-tech-more" style={{color:accent}}>View details <ArrowRight size={13}/></span></Link>;
 return <Link href={href} className="bn-service-card"><div className="bn-service-image" style={imageStyle(x.image,`${accent}${i%2?"16":"28"}`)}></div><div className="bn-service-body"><small>{x.categoryName||x.kind}</small><h3>{x.name}</h3><p>{x.description||"Professional service tailored to your requirements."}</p><span>Learn More <ArrowRight size={15}/></span></div></Link>;
}
function WorkCard({x,accent,slug,archetype}:{x:Item;accent:string;slug:string;archetype:Archetype}){
 const href=`/store/${slug}/${x.kind}/${x.id}`;
 if(archetype==="technical") return <Link href={href} className="bn-portfolio-tech-card"><div className="bn-portfolio-tech-top" style={{borderColor:accent}}><span style={{color:accent}}>{x.categoryName||x.kind}</span></div><h3>{x.name}</h3><p>View case study <ArrowRight size={13}/></p></Link>;
 return <Link href={href} className="bn-portfolio-card"><div className="bn-portfolio-image" style={imageStyle(x.image,"#e7edf4")}></div><h3>{x.name}</h3><p>{x.categoryName||x.kind}</p></Link>;
}
function PriceCard({x,i,accent,slug,archetype}:{x:Item;i:number;accent:string;slug:string;archetype:Archetype}){
 const price=x.price?`${x.currency} ${x.price.toLocaleString()}`:"Custom Quote";
 if(archetype==="corporate") return <article className={`bn-price-row ${i===1?"featured":""}`} key={x.id}>{i===1&&<span className="bn-popular" style={{background:accent}}>Popular</span>}<small>{x.categoryName||"Solution"}</small><h3>{x.name}</h3><p>{x.description||"Professional quality, delivered to your requirements."}</p><div className="bn-price" style={{color:accent}}>{price}</div><Link href={`/store/${slug}/start-project`} style={{background:accent}} className="bn-primary">Get a Quote <ArrowRight size={15}/></Link></article>;
 if(archetype==="technical") return <article className={`bn-price-tech-card ${i===1?"featured":""}`} key={x.id} style={i===1?{borderColor:accent}:undefined}><small style={{color:accent}}>{x.categoryName||"Plan"}</small><h3>{x.name}</h3><div className="bn-price mono">{price}</div><p>{x.description||"Built to spec, deployed fast."}</p><Link href={`/store/${slug}/start-project`} className="bn-primary square" style={{background:accent}}>Get a Quote <ArrowRight size={15}/></Link></article>;
 return <article className={`bn-price-card ${i===1?"featured":""}`} key={x.id}>{i===1&&<span className="bn-popular" style={{background:accent}}>Popular</span>}<div className="bn-price-image" style={imageStyle(x.image,`${accent}${i%2?"22":"12"}`)}></div><div className="bn-price-body"><small>{x.categoryName||"Solution"}</small><h3>{x.name}</h3><p>{x.description||"Professional quality, delivered to your requirements."}</p><div className="bn-price">{price}</div>{x.price>0&&<small>Starting price</small>}<Link href={`/store/${slug}/start-project`} style={{borderColor:accent,color:accent}}>Get a Quote <ArrowRight size={15}/></Link></div></article>;
}

function Services({p}:{p:Props}){const {store,slug,items,theme}=p;const accent=theme.accent;const archetype=archetypeFor(store,theme);const services=items.filter(x=>x.kind==="service");const list=(services.length?services:items).slice(0,8);const heroImg=(archetype==="corporate"||archetype==="technical")?null:(store.bannerUrl||store.storyImage||items.find(x=>x.image)?.image||null);return <><Header store={store} slug={slug} active="services" accent={accent}/><Hero store={store} slug={slug} active="services" archetype={archetype} copy={text(store,modeFor(store,theme))} accent={accent} hero={heroImg}><>Services<br/><span style={{color:accent}}>Made to Matter.</span></></Hero><main className="bn-universal-main"><section className="bn-universal-section"><SectionTitle eyebrow="OUR SERVICES" title={text(store,modeFor(store,theme)).services} sub="Choose the solution that fits your needs. Every offering is presented with the same clear, premium experience."/><div className={`bn-service-grid ${archetype}`}>{list.map((x,i)=><ServiceCard key={x.id} x={x} i={i} accent={accent} slug={slug} archetype={archetype}/>)}</div></section><section className="bn-band" style={{background:`linear-gradient(100deg,#061525,${accent})`}}><div><small>NEED SOMETHING CUSTOM?</small><h2>Tell us what you need.</h2><p>We can shape the right solution around your project, budget and timeline.</p></div><Link href={`/store/${slug}/start-project`}>Start a Project <ArrowRight size={17}/></Link></section></main><Footer store={store} slug={slug} accent={accent}/></>}

function About({p}:{p:Props}){const {store,slug,items,theme}=p;const copy=text(store,modeFor(store,theme));const accent=theme.accent;const archetype=archetypeFor(store,theme);const image=store.storyImage||store.bannerUrl||items.find(x=>x.image)?.image||null;const heroImg=(archetype==="corporate"||archetype==="technical")?null:image;return <><Header store={store} slug={slug} active="about" accent={accent}/><Hero store={store} slug={slug} active="about" archetype={archetype} copy={copy} accent={accent} hero={heroImg}><>More Than a Business,<br/><span style={{color:accent}}>We Build Possibilities.</span></></Hero><main className="bn-universal-main"><section className="bn-about-intro bn-universal-section"><div><small>WHO WE ARE</small><h2>{copy.about}</h2><p>{copy.description}</p><p>We combine expertise, technology and attention to detail to deliver work that makes a lasting impression.</p><Link href={`/store/${slug}/services`} className="bn-primary" style={{background:accent}}>Explore Our Services <ArrowRight size={16}/></Link></div><div className="bn-about-image" style={imageStyle(image,"linear-gradient(135deg,#dfe8f2,#8ea6bb)")}></div></section><section className="bn-values"><SectionTitle eyebrow="OUR MISSION, VISION & VALUES" title="What Drives Us"/><div className="bn-values-grid">{[["Our Mission","Deliver dependable, high-quality solutions that help customers move forward."],["Our Vision","Become the trusted choice in our field through quality, creativity and consistency."],["Our Values","Quality in everything we do, customer satisfaction, integrity and continuous improvement."]].map(([t,b])=><article key={t}><div className="bn-value-icon" style={{color:accent}}><Sparkles size={22}/></div><h3>{t}</h3><p>{b}</p><div className="bn-check"><Check size={15}/> Customer focused</div><div className="bn-check"><Check size={15}/> Professional delivery</div></article>)}</div></section><section className="bn-band" style={{background:`linear-gradient(100deg,#061525,${accent})`}}><div><small>READY TO WORK TOGETHER?</small><h2>Let’s bring your ideas to life.</h2><p>Tell us what you’re building and our team will help with the next step.</p></div><Link href={`/store/${slug}/start-project`}>Get a Quote <ArrowRight size={17}/></Link></section></main><Footer store={store} slug={slug} accent={accent}/></>}

function Portfolio({p}:{p:Props}){const {store,slug,items,theme}=p;const copy=text(store,modeFor(store,theme));const accent=theme.accent;const archetype=archetypeFor(store,theme);const work=items.filter(x=>x.image).slice(0,15);const heroImg=archetype==="technical"?null:(store.bannerUrl||work[0]?.image||null);return <><Header store={store} slug={slug} active="portfolio" accent={accent}/><Hero store={store} slug={slug} active="portfolio" archetype={archetype} copy={copy} accent={accent} hero={heroImg}><>Real Projects.<br/><span style={{color:accent}}>Real Results.</span></></Hero><main className="bn-universal-main"><section className="bn-universal-section"><SectionTitle eyebrow="OUR WORK" title="Featured Projects" sub="Explore examples of the products, services and projects this business delivers."/><div className={`bn-portfolio-grid ${archetype}`}>{work.length?work.map(x=><WorkCard key={x.id} x={x} accent={accent} slug={slug} archetype={archetype}/>):<div className="bn-empty">Add published products or services with images to populate this portfolio.</div>}</div></section><section className="bn-band light"><div><small>HAVE A PROJECT IN MIND?</small><h2>Let’s bring it to life.</h2><p>Whether it’s a small request or a larger project, we’re ready to help.</p></div><Link href={`/store/${slug}/start-project`} style={{background:accent,color:"#fff"}}>Get a Quote <ArrowRight size={17}/></Link></section></main><Footer store={store} slug={slug} accent={accent}/></>}

function Pricing({p}:{p:Props}){const {store,slug,items,theme}=p;const accent=theme.accent;const archetype=archetypeFor(store,theme);const copy=text(store,modeFor(store,theme));const list=items.filter(x=>x.price>0).slice(0,8);const heroImg=(archetype==="corporate"||archetype==="technical")?null:(store.bannerUrl||items.find(x=>x.image)?.image||null);const priceItems=(list.length?list:[{id:"empty",kind:"service",name:"Custom Project",description:"Tell us what you need and we’ll prepare a tailored quote.",price:0,currency:"",image:null,categoryName:null,type:"SERVICE",rentalUnit:null,isBookable:false} as Item]);return <><Header store={store} slug={slug} active="pricing" accent={accent}/><Hero store={store} slug={slug} active="pricing" archetype={archetype} copy={copy} accent={accent} hero={heroImg}><>Our Pricing<br/><span style={{color:accent}}>Quality for Every Budget.</span></></Hero><main className="bn-universal-main"><section className="bn-universal-section"><SectionTitle eyebrow="OUR PRICING" title="Simple, transparent options" sub="Starting prices are shown where available. For custom requirements, request a quote and we’ll recommend the best option."/><div className={`bn-price-grid ${archetype}`}>{priceItems.map((x,i)=><PriceCard key={x.id} x={x} i={i} accent={accent} slug={slug} archetype={archetype}/>)}</div></section><section className="bn-pricing-strip"><div><small>NEED A HIGHER VOLUME?</small><h2>Bulk Orders & Custom Pricing</h2><p>Large, recurring or corporate projects can receive a tailored package.</p></div><Link href={`/store/${slug}/start-project`} style={{background:accent}}>Request a Quote <ArrowRight size={16}/></Link></section><section className="bn-faq bn-universal-section"><SectionTitle eyebrow="FREQUENTLY ASKED QUESTIONS" title="Quick Answers"/><div className="bn-faq-grid">{["Are prices fixed?","Can I request a custom quote?","How long does delivery take?","Do you offer bulk discounts?"].map(q=><details key={q}><summary>{q}<ArrowRight size={15}/></summary><p>Contact {store.name} with your requirements and the team will confirm the most suitable option, timing and final price.</p></details>)}</div></section></main><Footer store={store} slug={slug} accent={accent}/></>}

function Contact({p}:{p:Props}){const {store,slug,theme}=p;const accent=theme.accent;const archetype=archetypeFor(store,theme);const copy=text(store,modeFor(store,theme));const city=[store.business?.city,store.business?.state,store.business?.country].filter(Boolean).join(", ");const heroImg=(archetype==="corporate"||archetype==="technical")?null:(store.bannerUrl||null);return <><Header store={store} slug={slug} active="contact" accent={accent}/><Hero store={store} slug={slug} active="contact" archetype={archetype} copy={copy} accent={accent} hero={heroImg}><>We’re Here<br/><span style={{color:accent}}>to Help.</span></></Hero><main className="bn-universal-main"><section className="bn-contact-grid bn-universal-section"><div className="bn-contact-form"><small>SEND US A MESSAGE</small><h2>Let’s Talk About Your Project</h2><p>Fill out the form below and we’ll get back to you as soon as possible.</p><div className="bn-form-grid"><label>Full Name<input placeholder="e.g. John Doe"/></label><label>Email Address<input placeholder="e.g. john@example.com"/></label><label>Phone Number<input placeholder={store.contactPhone||"Your phone number"}/></label><label>Subject<select defaultValue=""><option value="" disabled>Select a subject</option><option>General enquiry</option><option>Request a quote</option><option>Services</option></select></label></div><label>Your Message<textarea placeholder="Tell us about your project, requirements, or any questions..."></textarea></label><div className="bn-form-bottom"><label className="bn-consent"><input type="checkbox"/> I agree to be contacted about my inquiry.</label><Link href={primaryCta(store,slug).href} className="bn-primary" style={{background:accent}}>{primaryCta(store,slug).label} <ArrowRight size={16}/></Link></div></div><aside className="bn-contact-side"><div><h3>Contact Information</h3><p>Reach us through any of the channels below. We’d love to hear from you.</p>{store.contactPhone&&<a href={`tel:${store.contactPhone}`}><span style={{background:accent}}><Phone size={19}/></span><div><b>Call Us</b><small>{store.contactPhone}</small></div></a>}{store.contactEmail&&<a href={`mailto:${store.contactEmail}`}><span style={{background:accent}}><Mail size={19}/></span><div><b>Email Us</b><small>{store.contactEmail}</small></div></a>}<div><span style={{background:accent}}><MapPin size={19}/></span><div><b>Visit / Location</b><small>{city||"Contact us for location details."}</small></div></div></div><div className="bn-hours"><h3>Business Information</h3><div><span>Availability</span><b>Open for enquiries</b></div><div><span>Response time</span><b>Usually within 1 business day</b></div></div></aside></section><section className="bn-location" style={{backgroundImage:`linear-gradient(120deg,${accent}12,#eaf1f8)`}}><MapPin size={28} style={{color:accent}}/><div><small>OUR LOCATION</small><h2>{city||"Serving customers wherever they are"}</h2><p>{store.contactPhone||store.contactEmail||"Contact us to arrange a visit or consultation."}</p></div></section><section className="bn-band" style={{background:`linear-gradient(100deg,#061525,${accent})`}}><div><small>HAVE A LARGE PROJECT?</small><h2>Let’s discuss it.</h2><p>Special arrangements are available for larger, recurring or corporate work.</p></div><Link href={`/store/${slug}/start-project`}>Request a Quote <ArrowRight size={17}/></Link></section></main><Footer store={store} slug={slug} accent={accent}/></>}

export function UniversalSectionPage(p:Props){
 const normalized=p;
 switch(p.pageSlug.toLowerCase()){case"services":return <Services p={normalized}/>;case"about":return <About p={normalized}/>;case"portfolio":return <Portfolio p={normalized}/>;case"pricing":return <Pricing p={normalized}/>;case"contact":return <Contact p={normalized}/>;default:return null;}
}