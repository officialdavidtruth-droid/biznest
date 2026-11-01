import { storeHref as href } from "@/lib/utils/store-href";
import { formatMoney } from "@/lib/utils/format-money";
import React from "react";
import { MenuLinks } from "@/components/storefront/store-menu";
import Link from "next/link";
import { HeenzyStorefront } from "@/components/storefront/templates/heenzy-home";
import { WanderlyHome, NestoriaHome } from "@/components/storefront/reference-homes";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

export type LegacyCatalogItem = {
  id:string; kind:"product"|"service"; name:string; description:string|null; price:number;
  currency:string; image:string|null; categoryName:string|null; type:string; rentalUnit:string|null; isBookable:boolean;
};
type Review={id:string;rating:number;comment:string|null;author:{name:string|null}};
type Store={name:string;logoUrl:string|null;bannerUrl:string|null;contactEmail:string|null;contactPhone:string|null;sellsProducts:boolean;heroOverrides?:any;storyOverrides?:any;socialLinks?:any;business:{category?:string|null;description:string|null;phone?:string|null;email?:string|null;city?:string|null;state?:string|null;country?:string|null}};
type Props={store:Store;slug:string;catalogItems:LegacyCatalogItem[];navCategories:CategoryTreeNode[];goodReviews:Review[];avgRating:number|null;completedOrders:number;trustScore?:number|null;trustChecklist?:any;social?:Record<string,string>;theme?:any};

const heroHeadline=(st:Store)=>String(st.heroOverrides?.headline||"").trim()||null;
const heroSub=(p:Props)=>String(p.store.heroOverrides?.subtitle||"").trim()||p.store.business.description||p.theme?.sub||`Welcome to ${p.store.name}.`;
const heroCta=(p:Props)=>String(p.store.heroOverrides?.ctaLabel||"").trim()||p.theme?.cta||"Shop now";
const eyebrow=(p:Props)=>String(p.store.business.category||p.store.name||"").replace(/[_-]+/g," ").toUpperCase();
const cats=(p:Props)=>p.navCategories.slice(0,6);
const money=(i:LegacyCatalogItem)=>formatMoney(i.price,i.currency);
const image=(url:string|null)=>url?{backgroundImage:`linear-gradient(135deg,rgba(0,0,0,.04),rgba(0,0,0,.08)),url(${url})`}:undefined;

function Header({p,variant}:{p:Props;variant:string}){
 const {store,slug}=p;
 return <header className={`lt-header lt-header-${variant}`}><Link href={href(slug)} className="lt-brand">{store.logoUrl?<img src={store.logoUrl} alt={store.name}/>:<span>{store.name?.[0]||"B"}</span>}<b>{store.name}</b></Link><nav><MenuLinks slug={slug} fallbackNode={<><Link href={href(slug)}>Home</Link><Link href={href(slug,"/catalog")}>Catalog</Link><Link href={href(slug,"/search")}>Search</Link><Link href={href(slug,"/about")}>About</Link></>}/></nav><div className="lt-actions"><Link href={href(slug,"/account")}>Account</Link>{store.sellsProducts&&<Link href={href(slug,"/cart")}>Cart</Link>}</div></header>;
}
function Cards({p,items,limit=8,className=""}:{p:Props;items:LegacyCatalogItem[];limit?:number;className?:string}){
 return <div className={`lt-cards ${className}`}>{items.slice(0,limit).map(i=><Link href={href(p.slug,`/${i.kind}/${i.id}`)} className="lt-card" key={i.id}><div className="lt-card-image" style={image(i.image)}>{!i.image&&<span>{i.name?.[0]}</span>}</div><div className="lt-card-body"><small>{i.categoryName||i.kind}</small><h3>{i.name}</h3><p>{i.description||"Quality products and services from this business."}</p><strong>{money(i)}</strong><em>{i.isBookable?"Book now →":"View details →"}</em></div></Link>)}</div>;
}
function Footer({p,dark=false}:{p:Props;dark?:boolean}){const st=p.store;const phone=st.contactPhone||st.business.phone;const email=st.contactEmail||st.business.email;const address=[st.business.city,st.business.state,st.business.country].filter(Boolean).join(", ");const social=(st.socialLinks||{}) as Record<string,string>;return <footer className={`lt-footer ${dark?"dark":""}`}><div><b>{st.name}</b><p>{st.business.description||"Built with BizNest."}</p></div><div><b>Explore</b><Link href={href(p.slug,"/catalog")}>Catalog</Link><Link href={href(p.slug,"/search")}>Search</Link><Link href={href(p.slug,"/account")}>Account</Link></div><div><b>Contact</b>{phone&&<a href={`tel:${phone}`}>{phone}</a>}{email&&<a href={`mailto:${email}`}>{email}</a>}{address&&<span>{address}</span>}{Object.entries(social).filter(([,v])=>v).map(([k,v])=><a key={k} href={String(v)} target="_blank" rel="noopener noreferrer" style={{textTransform:"capitalize"}}>{k}</a>)}</div></footer>}

function Fresh({p}:{p:Props}){
 const {store,slug,catalogItems}=p; const hero=store.bannerUrl||catalogItems[0]?.image;
 return <div className="lt-root fresh"><Header p={p} variant="fresh"/><section className="fresh-hero" style={image(hero)}><div><small>{store.name.toUpperCase()}</small><h1>{heroHeadline(store)||store.name}</h1><p>{heroSub(p)}</p><Link href={href(slug,"/catalog")} className="lt-btn">{heroCta(p)}</Link></div></section><section className="fresh-cats"><h2>Shop by category</h2><div>{p.navCategories.slice(0,6).map(c=><Link href={href(slug,`/category/${c.id}`)} key={c.id}>{c.name}<span>→</span></Link>)}</div></section><section className="lt-section"><div className="lt-section-head"><div><small>CURATED FOR YOU</small><h2>Fresh picks</h2></div><Link href={href(slug,"/catalog")}>View all →</Link></div><Cards p={p} items={catalogItems}/></section><section className="fresh-story"><div><small>ABOUT THE STORE</small><h2>About {store.name}</h2><p>{store.business.description||`Welcome to ${store.name}.`}</p></div><div className="fresh-stat"><b>{catalogItems.length}+</b><span>items & services</span><b>{p.completedOrders}+</b><span>completed orders</span></div></section><Footer p={p}/></div>
}
function Nova({p}:{p:Props}){
 const {store,slug,catalogItems}=p; const hero=store.bannerUrl||catalogItems[0]?.image;
 return <div className="lt-root nova"><aside className="nova-side"><Link href={href(slug)} className="nova-mark">{store.logoUrl?<img src={store.logoUrl} alt=""/>:<span>{store.name?.[0]?.toUpperCase()||"N"}</span>}</Link><div><small>STUDIO</small><h4>{store.name}</h4><nav><MenuLinks slug={slug} fallbackNode={<><Link href={href(slug)}>Home</Link><Link href={href(slug,"/catalog")}>Work / Catalog</Link><Link href={href(slug,"/about")}>About</Link><Link href={href(slug,"/contact")}>Contact</Link></>}/></nav></div><small>© {new Date().getFullYear()}</small></aside><main className="nova-main"><section className="nova-hero"><div><small>{eyebrow(p)}</small><h1>{heroHeadline(store)||store.name}</h1><p>{heroSub(p)}</p><Link href={href(slug,"/catalog")} className="nova-link">{heroCta(p)}</Link></div><div className="nova-hero-image" style={image(hero)}/></section><section className="nova-grid"><div><small>SELECTED WORK</small><h2>Our work</h2></div><Cards p={p} items={catalogItems} limit={6} className="nova-cards"/></section><Footer p={p} dark/></main></div>
}
function Violet({p}:{p:Props}){
 const {store,slug,catalogItems}=p;
 return <div className="lt-root violet"><Header p={p} variant="violet"/><section className="violet-hero" style={image(store.bannerUrl||catalogItems[0]?.image)}><div><small>{eyebrow(p)}</small><h1>{heroHeadline(store)||store.name}</h1><p>{heroSub(p)}</p><Link href={href(slug,"/catalog")} className="violet-btn">{heroCta(p)}</Link></div></section><section className="violet-cats"><h2>Browse categories</h2><div>{p.navCategories.slice(0,6).map(c=><Link href={href(slug,`/category/${c.id}`)} key={c.id}><span>{c.name?.[0]}</span><b>{c.name}</b></Link>)}</div></section><section className="lt-section"><div className="lt-section-head"><div><small>BEST SELLERS</small><h2>Popular right now</h2></div><Link href={href(slug,"/catalog")}>See all →</Link></div><Cards p={p} items={catalogItems} className="violet-cards"/></section><Footer p={p} dark/></div>
}
function Premium({p}:{p:Props}){
 const {store,slug,catalogItems}=p;
 return <div className="lt-root premium"><div className="premium-bar">{store.name} · Browse the catalog and order online</div><Header p={p} variant="premium"/><div className="premium-layout"><aside><b>Shop departments</b>{p.navCategories.slice(0,10).map(c=><Link href={href(slug,`/category/${c.id}`)} key={c.id}>{c.name}<span>›</span></Link>)}<div className="premium-side-card"><small>NEW IN</small><b>Latest arrivals</b><Link href={href(slug,"/catalog")}>Shop new</Link></div></aside><main><section className="premium-hero"><div><small>{eyebrow(p)}</small><h1>{heroHeadline(store)||store.name}</h1><p>{heroSub(p)}</p><Link href={href(slug,"/catalog")} className="premium-btn">{heroCta(p)}</Link></div><div style={image(store.bannerUrl||catalogItems[0]?.image)}/></section><div className="premium-rail-head"><h2>Featured</h2></div><Cards p={p} items={catalogItems} limit={4} className="premium-cards"/><div className="premium-rail-head"><h2>Recommended for you</h2><Link href={href(slug,"/catalog")}>View all</Link></div><Cards p={p} items={catalogItems.slice(4)} limit={8} className="premium-cards"/></main></div><Footer p={p}/></div>
}
function HomeVista({p}:{p:Props}){
 const {store,slug,catalogItems}=p;
 return <div className="lt-root homevista"><Header p={p} variant="homevista"/><section className="hv-hero"><div><small>{eyebrow(p)}</small><h1>{heroHeadline(store)||store.name}</h1><p>{heroSub(p)}</p><div className="hv-search"><input placeholder="Location, neighborhood or property"/><select><option>Any property type</option><option>Apartment</option><option>House</option></select><Link href={href(slug,"/catalog")}>Search</Link></div></div><div style={image(store.bannerUrl||catalogItems[0]?.image)}/></section>{cats(p).length>0&&<section className="hv-types"><h2>Browse categories</h2><div>{cats(p).map(c=><Link href={href(slug,`/category/${c.id}`)} key={c.id}><span>{c.name?.[0]}</span><b>{c.name}</b><small>View listings</small></Link>)}</div></section>}<section className="lt-section"><div className="lt-section-head"><div><small>FEATURED LISTINGS</small><h2>Homes worth seeing</h2></div><Link href={href(slug,"/catalog")}>View all →</Link></div><Cards p={p} items={catalogItems} className="hv-cards"/></section><section className="hv-agent"><div><small>ABOUT US</small><h2>Talk to {store.name}</h2>{store.business.description&&<p>{store.business.description}</p>}<Link href={href(slug,"/search")}>Talk to us →</Link></div><div className="hv-map">{[store.business.city,store.business.state].filter(Boolean).join(", ")}</div></section><Footer p={p}/></div>
}
function Rrw({p}:{p:Props}){
 const {store,slug,catalogItems}=p;
 return <div className="lt-root rrw"><Header p={p} variant="rrw"/><section className="rrw-hero" style={image(store.bannerUrl||catalogItems[0]?.image)}><div><small>{eyebrow(p)}</small><h1>{heroHeadline(store)||store.name}</h1><p>{heroSub(p)}</p><Link href={href(slug,"/catalog")} className="rrw-btn">{heroCta(p)}</Link></div></section><section className="rrw-pills"><span>Browse the fleet</span><span>Book online</span><span>Ask a question</span></section><section className="lt-section"><div className="lt-section-head"><div><small>THE FLEET</small><h2>Choose your drive</h2></div><Link href={href(slug,"/catalog")}>View fleet →</Link></div><Cards p={p} items={catalogItems} className="rrw-cards"/></section><Footer p={p} dark/></div>
}
function Marketplace({p}:{p:Props}){
 const {store,slug,catalogItems}=p;
 return <div className="lt-root marketplace"><div className="market-top"><b>{store.name}</b><span>Shop online</span></div><div className="market-search"><Link href={href(slug)} className="lt-brand">{store.name}</Link><input placeholder="Search products, services and categories"/><button>Search</button><Link href={href(slug,"/cart")}>Cart</Link></div><div className="market-layout"><aside><b>Categories</b>{p.navCategories.slice(0,12).map(c=><Link href={href(slug,`/category/${c.id}`)} key={c.id}>{c.name}<span>›</span></Link>)}</aside><main><section className="market-hero"><div><small>{eyebrow(p)}</small><h1>{heroHeadline(store)||store.name}</h1><p>{heroSub(p)}</p><Link href={href(slug,"/catalog")}>{heroCta(p)} →</Link></div></section><div className="market-services"><span>🛒 Order online</span><span>🔎 Search the catalog</span><span>▦ Browse categories</span><span>☎ Contact us</span></div><section className="lt-section"><div className="lt-section-head"><h2>Featured products</h2><Link href={href(slug,"/catalog")}>View all →</Link></div><Cards p={p} items={catalogItems} className="market-cards"/></section><section className="market-promo"><div><small>ABOUT</small><h2>{store.name}</h2>{store.business.description&&<p>{store.business.description}</p>}</div><Link href={href(slug,"/about")}>Learn more →</Link></section></main></div><Footer p={p} dark/></div>
}
function Arcova({p}:{p:Props}){
 const {store,slug,catalogItems}=p; const hero=store.bannerUrl||catalogItems[0]?.image;
 return <div className="lt-root arcova"><Header p={p} variant="arcova"/><section className="arc-hero"><div><small>{eyebrow(p)}</small><h1>{heroHeadline(store)||store.name}</h1><p>{heroSub(p)}</p><Link href={href(slug,"/catalog")} className="arc-btn">{heroCta(p)}</Link></div><div style={image(hero)}/></section><section className="arc-intro"><small>ABOUT</small><h2>{store.name}</h2>{store.business.description&&<p>{store.business.description}</p>}</section><section className="arc-projects"><div className="lt-section-head"><div><small>SELECTED PROJECTS</small><h2>Recent work</h2></div><Link href={href(slug,"/catalog")}>All projects →</Link></div><Cards p={p} items={catalogItems} className="arc-cards"/></section><Footer p={p} dark/></div>
}
function Rivora({p}:{p:Props}){return <div className="lt-root rivora"><Header p={p} variant="rivora"/><section className="riv-hero"><div><small>{eyebrow(p)}</small><h1>{heroHeadline(p.store)||p.store.name}</h1><p>{heroSub(p)}</p><Link href={href(p.slug,"/catalog")} className="riv-btn">{heroCta(p)}</Link></div><div style={image(p.store.bannerUrl||p.catalogItems[0]?.image)}/></section><section className="riv-cats">{p.navCategories.slice(0,6).map(c=><Link href={href(p.slug,`/category/${c.id}`)} key={c.id}><b>{c.name}</b><span>Fresh picks →</span></Link>)}</section><section className="lt-section"><div className="lt-section-head"><div><small>FRESH PICKS</small><h2>This week's basket</h2></div><Link href={href(p.slug,"/catalog")}>View all →</Link></div><Cards p={p} items={p.catalogItems}/></section><Footer p={p}/></div>}
function JuiceLife({p}:{p:Props}){return <div className="lt-root juicelife"><Header p={p} variant="juicelife"/><section className="juice-hero" style={image(p.store.bannerUrl||p.catalogItems[0]?.image)}><div><small>{eyebrow(p)}</small><h1>{heroHeadline(p.store)||p.store.name}</h1><p>{heroSub(p)}</p><Link href={href(p.slug,"/catalog")} className="juice-btn">{heroCta(p)}</Link></div></section>{cats(p).length>0&&<section className="juice-flavors">{cats(p).map(c=><Link href={href(p.slug,`/category/${c.id}`)} key={c.id}><span>{c.name?.[0]}</span><b>{c.name}</b><small>View items</small></Link>)}</section>}<section className="lt-section"><div className="lt-section-head"><div><small>BEST SELLERS</small><h2>Juice bar favorites</h2></div><Link href={href(p.slug,"/catalog")}>View all →</Link></div><Cards p={p} items={p.catalogItems} className="juice-cards"/></section><Footer p={p} dark/></div>}
function Fabtex({p}:{p:Props}){return <div className="lt-root fabtex"><Header p={p} variant="fabtex"/><section className="fab-hero"><div><small>{eyebrow(p)}</small><h1>{heroHeadline(p.store)||p.store.name}</h1><p>{heroSub(p)}</p><Link href={href(p.slug,"/catalog")} className="fab-btn">{heroCta(p)}</Link></div><div style={image(p.store.bannerUrl||p.catalogItems[0]?.image)}/></section><section className="fab-marquee">{Array(4).fill(p.store.name.toUpperCase()).join(" · ")}</section><section className="lt-section"><div className="lt-section-head"><div><small>THE EDIT</small><h2>Featured pieces</h2></div><Link href={href(p.slug,"/catalog")}>Shop all →</Link></div><Cards p={p} items={p.catalogItems} className="fab-cards"/></section><section className="fab-editorial"><div><small>ABOUT</small><h2>{p.store.name}</h2>{p.store.business.description&&<p>{p.store.business.description}</p>}</div><div style={image(p.catalogItems[1]?.image||p.store.bannerUrl)}/></section><Footer p={p}/></div>}

export function LegacyTemplateHome({name,p}:{name:string;p:Props}){
 if(name === "Wanderly Travel") return <WanderlyHome p={p as any}/>;
 if(name === "Nestoria Real Estate") return <NestoriaHome p={p as any}/>;
 if(name==="Heenzy Sneaker Co.") return <HeenzyStorefront {...p as any} catalogCategories={[]} />;
 if(name==="Fresh & Co.") return <Fresh p={p}/>;
 if(name.startsWith("Nova Studio") && name!=="Nova Studio — Ivory Minimal") return <Nova p={p}/>;
 if(name==="Violet") return <Violet p={p}/>;
 if(name==="Premium Marketplace") return <Premium p={p}/>;
 if(name==="HomeVista") return <HomeVista p={p}/>;
 if(name==="rRW Premium Rental") return <Rrw p={p}/>;
 if(name==="Marketplace Hub") return <Marketplace p={p}/>;
 if(name==="Arcova Architecture") return <Arcova p={p}/>;
 if(name==="Rivora Fresh") return <Rivora p={p}/>;
 if(name==="JuiceLife") return <JuiceLife p={p}/>;
 if(name==="Fabtex") return <Fabtex p={p}/>;
 return null;
}
