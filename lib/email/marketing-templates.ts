/**
 * BizNest Marketing email designs.
 *
 * The catalogue intentionally contains only the six approved campaign designs:
 *  - newsletter: editorial hotel-style newsletter
 *  - welcome: personal welcome note
 *  - discount: bold percentage-off promotion
 *  - discount_alt: split editorial discount promotion
 *  - restaurant: restaurant newsletter
 *  - anticipation: coming-soon / anticipation campaign
 *
 * All visible business content is data-driven. The designs contain layout,
 * typography and spacing only; names, colours, imagery, prices, offers, links,
 * products/services and contact details come from the connected business.
 */

export type MarketingTemplateId =
  | "newsletter"
  | "welcome"
  | "discount"
  | "discount_alt"
  | "restaurant"
  | "anticipation";

export type MarketingTemplateCategory = "news" | "sales" | "customers" | "events" | "industry";
export type MarketingExtra = "items" | "highlights" | "offer" | "event" | "secondaryCta";
export type MarketingFontKey = "brand" | "sans" | "modern" | "serif" | "elegant" | "rounded";
export type MarketingButtonShape = "rounded" | "pill" | "square";
export type MarketingAlign = "left" | "center";

export type MarketingItem = {
  kind?: "product" | "service";
  name: string;
  description?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  href?: string | null;
};

export type MarketingBrand = {
  name: string;
  storeId: string;
  slug: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  fontFamily: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  socialLinks?: Record<string, string> | null;
  businessType?: string | null;
  businessDescription?: string | null;
  sellsProducts: boolean;
  offersServices: boolean;
};

export type MarketingStyle = {
  primary?: string;
  button?: string;
  background?: string;
  text?: string;
  font?: MarketingFontKey;
  buttonShape?: MarketingButtonShape;
  align?: MarketingAlign;
  showLogo?: boolean;
  showImage?: boolean;
  showItems?: boolean;
  showFooterDetails?: boolean;
};

export type MarketingContent = {
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl?: string | null;
  items: MarketingItem[];
  previewText?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  highlights?: string[];
  offerLabel?: string;
  couponCode?: string;
  offerNote?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  signature?: string;
  closingNote?: string;
  style?: MarketingStyle;
};

export type MarketingCampaignInput = MarketingContent & { template: MarketingTemplateId; subject: string };
export type MarketingDefaults = MarketingContent & { subject: string };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.space";

export type MarketingTemplateMeta = {
  id: MarketingTemplateId;
  name: string;
  description: string;
  icon: string;
  category: MarketingTemplateCategory;
  extras: MarketingExtra[];
  align: MarketingAlign;
  font: MarketingFontKey;
  labels?: Partial<Record<"eyebrow" | "highlights" | "offerLabel" | "offerNote" | "couponCode" | "image", string>>;
};

export const MARKETING_CATEGORIES: Array<{ id: MarketingTemplateCategory | "all"; label: string }> = [
  { id: "all", label: "All designs" },
  { id: "sales", label: "Sales & offers" },
  { id: "news", label: "News & updates" },
  { id: "customers", label: "Customer care" },
  { id: "events", label: "Events & seasons" },
  { id: "industry", label: "By industry" },
];

export const MARKETING_TEMPLATES: MarketingTemplateMeta[] = [
  { id: "newsletter", name: "Editorial Newsletter", description: "A restrained, image-led newsletter with one main story and a few useful highlights.", icon: "✦", category: "news", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "elegant" },
  { id: "welcome", name: "Personal Welcome", description: "A personal welcome note with the recipient's name and a simple next step.", icon: "♡", category: "customers", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "elegant" },
  { id: "discount", name: "Bold Discount", description: "A high-impact percentage-off campaign focused on one clear offer.", icon: "%", category: "sales", extras: ["offer", "items", "highlights", "secondaryCta"], align: "left", font: "elegant" },
  { id: "discount_alt", name: "Split Discount", description: "An editorial split layout for a premium percentage-off campaign.", icon: "◇", category: "sales", extras: ["offer", "items", "highlights", "secondaryCta"], align: "left", font: "serif" },
  { id: "restaurant", name: "Restaurant Newsletter", description: "A food-first newsletter with one featured story, dishes and a reservation action.", icon: "◉", category: "industry", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "elegant" },
  { id: "anticipation", name: "Coming Soon", description: "A focused anticipation campaign for a launch, opening, event or new experience.", icon: "◌", category: "events", extras: ["event", "highlights", "secondaryCta"], align: "left", font: "elegant" },
];

export const MARKETING_FONT_OPTIONS = [
  { id: "brand", label: "Brand font" },
  { id: "sans", label: "Clean sans" },
  { id: "modern", label: "Modern" },
  { id: "serif", label: "Editorial serif" },
  { id: "elegant", label: "Luxury serif" },
  { id: "rounded", label: "Rounded" },
] as const;

export const MARKETING_LIMITS = {
  subject: 180, previewText: 180, eyebrow: 80, headline: 160, body: 2400, ctaLabel: 48, ctaUrl: 1000,
  secondaryCtaLabel: 48, secondaryCtaUrl: 1000, highlight: 120, offerLabel: 80, couponCode: 48, offerNote: 240,
  eventDate: 80, eventTime: 80, eventLocation: 160, signature: 120, closingNote: 300,
  itemName: 100, itemPrice: 80, itemDescription: 300, itemUrl: 1000, items: 6,
} as const;

export function getMarketingTemplate(id: string): MarketingTemplateMeta {
  return MARKETING_TEMPLATES.find((t) => t.id === id) ?? MARKETING_TEMPLATES[0];
}

function industryOf(brand: MarketingBrand) {
  const s = `${brand.businessType ?? ""} ${brand.businessDescription ?? ""}`.toLowerCase();
  if (/hotel|resort|hospitality|lodg|accommodation/.test(s)) return "hospitality";
  if (/restaurant|food|cafe|bar|bakery|kitchen|dining/.test(s)) return "food";
  if (/salon|spa|beauty|barber/.test(s)) return "beauty";
  if (/agency|consult|software|saas|professional/.test(s)) return "professional";
  return "commerce";
}

function firstImage(brand: MarketingBrand, items: MarketingItem[]) {
  return items.find((x) => x.imageUrl)?.imageUrl ?? brand.bannerUrl ?? brand.logoUrl ?? null;
}

export function defaultMarketingContent(template: MarketingTemplateId, brand: MarketingBrand, items: MarketingItem[]): MarketingDefaults {
  const ind = industryOf(brand);
  const hero = firstImage(brand, items);
  const noun = ind === "hospitality" ? "stay" : ind === "food" ? "dining experience" : ind === "beauty" ? "experience" : ind === "professional" ? "business" : "collection";
  const featured = items.slice(0, template === "restaurant" ? 3 : 3);
  const base: MarketingDefaults = {
    subject: "A little something from " + brand.name,
    previewText: "A short update from " + brand.name,
    eyebrow: "A little something special",
    headline: "Make your next " + noun + " memorable.",
    body: brand.businessDescription || "A short, useful update from our team. We have something worth sharing with you.",
    ctaLabel: ind === "hospitality" ? "Explore your stay" : ind === "food" ? "View our menu" : "Discover more",
    ctaUrl: `${APP_URL}/${brand.slug}`,
    imageUrl: hero,
    items: featured,
    highlights: ["Made for you", "Thoughtfully curated", "Easy to explore"],
    offerLabel: "20% OFF",
    offerNote: "Limited-time offer. Terms may apply.",
    signature: "The " + brand.name + " team",
    closingNote: "We look forward to welcoming you.",
  };
  switch (template) {
    case "newsletter":
      return { ...base, subject: `This week at ${brand.name}`, eyebrow: "A note from us", headline: "A little inspiration for your week.", body: "Discover a few highlights, experiences and updates from our business — carefully selected and easy to explore.", ctaLabel: "Discover more", highlights: ["What’s new", "Featured experience", "A little inspiration"] };
    case "welcome":
      return { ...base, subject: `Welcome to ${brand.name}`, previewText: "We're glad you're here.", eyebrow: "A warm welcome", headline: "Welcome to a better experience.", body: "Thank you for choosing us. We’re delighted to have you with us and look forward to creating something memorable for you.", ctaLabel: "Explore your experience", highlights: ["Explore what we offer", "Discover something new", "Get in touch"] };
    case "discount":
      return { ...base, subject: `${base.offerLabel} at ${brand.name}`, previewText: "A limited-time offer for you.", eyebrow: "Limited-time offer", headline: "Enjoy " + base.offerLabel + " on your next visit.", body: "Take a little time for yourself and enjoy this special offer while it lasts.", ctaLabel: "Claim the offer", highlights: ["Limited time", "Selected items or services", "Easy booking or ordering"] };
    case "discount_alt":
      return { ...base, subject: `Your special offer from ${brand.name}`, previewText: "Save on your next experience.", eyebrow: "Special offer", headline: "Enjoy " + base.offerLabel + " on your next experience.", body: "A considered offer, designed to make your next purchase, booking or visit even better.", ctaLabel: "Book now", highlights: ["Offer period", "Eligible products or services"], items: featured.slice(0, 2) };
    case "restaurant":
      return { ...base, subject: `Great moments at ${brand.name}`, previewText: "Fresh flavours, good company and something worth tasting.", eyebrow: "Good food · great company", headline: "Great moments start at the table.", body: "Discover fresh flavours, signature dishes and a dining experience made for good conversations and memorable moments.", ctaLabel: "Reserve a table", highlights: ["Fresh flavours", "Signature drinks", "Warm ambience"], items: featured.slice(0, 3) };
    case "anticipation":
      return { ...base, subject: `Something special is coming to ${brand.name}`, previewText: "Be the first to know.", eyebrow: "Something special is coming", headline: "A new experience is almost here.", body: "Get ready for something new. We’ll share the details soon — and you’ll be among the first to know.", ctaLabel: "Stay updated", highlights: ["A new experience", "Fresh details coming soon", "Be first to know"] };
  }
}

export function normalizeMarketingContent(raw: unknown): MarketingContent {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const str = (k: string) => typeof r[k] === "string" ? String(r[k]) : "";
  const arr = (k: string) => Array.isArray(r[k]) ? r[k].filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  const items = Array.isArray(r.items) ? r.items.map((x) => {
    const o = x && typeof x === "object" ? x as Record<string, unknown> : {};
    return { kind: o.kind === "service" ? "service" : "product", name: String(o.name ?? ""), description: typeof o.description === "string" ? o.description : null, price: typeof o.price === "string" ? o.price : null, imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : null, href: typeof o.href === "string" ? o.href : null } as MarketingItem;
  }).filter((x) => x.name).slice(0, MARKETING_LIMITS.items) : [];
  const style = r.style && typeof r.style === "object" ? r.style as MarketingStyle : undefined;
  return { eyebrow: str("eyebrow"), headline: str("headline"), body: str("body"), ctaLabel: str("ctaLabel"), ctaUrl: str("ctaUrl"), imageUrl: str("imageUrl") || null, items, previewText: str("previewText"), secondaryCtaLabel: str("secondaryCtaLabel"), secondaryCtaUrl: str("secondaryCtaUrl"), highlights: arr("highlights"), offerLabel: str("offerLabel"), couponCode: str("couponCode"), offerNote: str("offerNote"), eventDate: str("eventDate"), eventTime: str("eventTime"), eventLocation: str("eventLocation"), signature: str("signature"), closingNote: str("closingNote"), style };
}

function esc(v: unknown) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeUrl(v: string | null | undefined, fallback = "#") {
  const u = String(v ?? "").trim();
  if (!u) return fallback;
  if (/^(https?:|mailto:|tel:|#)/i.test(u)) return esc(u);
  return fallback;
}
function color(v: string | undefined, fallback: string) { return /^#[0-9a-f]{3,8}$/i.test(v ?? "") ? v! : fallback; }
function textLines(v: string) { return esc(v).replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>" ); }
function fontFor(key: MarketingFontKey | undefined, brand: MarketingBrand) {
  if (key === "serif" || key === "elegant") return "Georgia, 'Times New Roman', serif";
  if (key === "rounded") return "Arial Rounded MT Bold, Arial, sans-serif";
  if (key === "modern") return "Arial, Helvetica, sans-serif";
  if (key === "sans") return "Arial, Helvetica, sans-serif";
  return brand.fontFamily || "Arial, Helvetica, sans-serif";
}

type Ctx = { brand: MarketingBrand; c: MarketingContent; primary: string; accent: string; soft: string; bg: string; text: string; muted: string; font: string; button: string; line: string; recipient?: string; secondary: string };
function ctx(brand: MarketingBrand, c: MarketingContent, recipient?: string): Ctx {
  const s = c.style ?? {};
  const primary = color(s.primary ?? brand.primary, "#0d3b36");
  const accent = color(brand.accent, "#c8963e");
  const bg = color(s.background ?? "#f5f4ef", "#f5f4ef");
  const text = color(s.text ?? brand.text, "#15322f");
  const button = color(s.button ?? accent, accent);
  return { brand, c, primary, accent, soft: "#eef1ec", bg, text, muted: "#65706d", font: fontFor(s.font, brand), button, line: "#ded8ca", recipient, secondary: color(brand.secondary, "#102f2b") };
}
function img(url: string | null | undefined, alt: string, width = 560, height?: number) {
  if (!url) return "";
  const h = height ? `height:${height}px;object-fit:cover;` : "height:auto;";
  return `<img src="${safeUrl(url)}" alt="${esc(alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;${h}border:0;margin:0 auto;" />`;
}
function button(x: Ctx, label: string, href: string, invert = false) {
  if (!label) return "";
  const bg = invert ? "#ffffff" : x.button;
  const fg = invert ? x.primary : "#ffffff";
  return `<a href="${safeUrl(href)}" style="display:inline-block;background:${bg};color:${fg};font-family:${x.font};font-size:13px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;text-decoration:none;padding:15px 25px;border-radius:3px;">${esc(label)} &rarr;</a>`;
}
function logo(x: Ctx, dark = false) {
  const b = x.brand;
  if (b.logoUrl) return `<img src="${safeUrl(b.logoUrl)}" alt="${esc(b.name)}" style="display:block;max-width:190px;max-height:58px;width:auto;height:auto;border:0;" />`;
  return `<div style="font-family:${x.font};font-size:23px;line-height:27px;font-weight:700;letter-spacing:.5px;color:${dark ? "#ffffff" : x.primary};">${esc(b.name)}</div>`;
}
function footer(x: Ctx, dark = false) {
  const links = Object.entries(x.brand.socialLinks ?? {}).filter(([,u]) => u).slice(0, 5);
  const fg = dark ? "#f8f4e9" : x.muted;
  return `<div style="padding:26px 28px 28px;text-align:center;border-top:1px solid ${dark ? "rgba(255,255,255,.18)" : x.line};background:${dark ? x.secondary : "#ffffff"};color:${fg};">${logo(x,dark)}${links.length ? `<div style="margin-top:14px;">${links.map(([n,u])=>`<a href="${safeUrl(u)}" style="font-size:11px;color:${fg};text-decoration:none;margin:0 7px;">${esc(n)}</a>`).join("")}</div>` : ""}${x.brand.contactEmail || x.brand.contactPhone ? `<div style="font-size:11px;line-height:18px;margin-top:12px;">${esc(x.brand.contactEmail ?? "")}${x.brand.contactEmail && x.brand.contactPhone ? " &middot; " : ""}${esc(x.brand.contactPhone ?? "")}</div>` : ""}<div style="font-size:10px;line-height:16px;margin-top:15px;opacity:.7;">You are receiving this email because you subscribed to updates from ${esc(x.brand.name)}. <a href="{{unsubscribe_url}}" style="color:inherit;text-decoration:underline;">Unsubscribe</a></div><div style="font-size:9px;margin-top:8px;opacity:.45;">Powered by BizNest</div></div>`;
}
function itemCard(x: Ctx, item: MarketingItem, dark = false) {
  const image = item.imageUrl ? `<div>${img(item.imageUrl,item.name,170,125)}</div>` : "";
  const title = `<div style="font-family:${x.font};font-size:18px;line-height:23px;font-weight:700;color:${dark ? "#fff" : x.text};margin-top:${image?12:0}px;">${esc(item.name)}</div>`;
  const desc = item.description ? `<div style="font-size:12px;line-height:18px;color:${dark?"#c8d1ce":x.muted};margin-top:6px;">${esc(item.description)}</div>` : "";
  const price = item.price ? `<div style="font-size:13px;font-weight:800;color:${dark?x.accent:x.primary};margin-top:8px;">${esc(item.price)}</div>` : "";
  const link = item.href ? `<div style="margin-top:10px;"><a href="${safeUrl(item.href)}" style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${dark?x.accent:x.primary};text-decoration:none;">View details &rarr;</a></div>` : "";
  return `<td valign="top" width="${item===undefined?"100":"33"}%" style="padding:0 6px 18px;">${image}${title}${desc}${price}${link}</td>`;
}
function featuredThree(x: Ctx) {
  const list = x.c.items.slice(0,3);
  if (!list.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${list.map((i)=>itemCard(x,i)).join("")}</tr></table>`;
}
function highlights(x: Ctx, dark = false) {
  const hs = (x.c.highlights ?? []).slice(0,3);
  if (!hs.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${hs.map((h,i)=>`<td width="33%" valign="top" style="padding:0 10px;text-align:center;border-right:${i<hs.length-1?`1px solid ${dark?"rgba(255,255,255,.2)":x.line}`:"0"};"><div style="font-size:18px;color:${dark?x.accent:x.accent};margin-bottom:8px;">${["◆","◈","✦"][i] ?? "•"}</div><div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${dark?"#fff":x.primary};">${esc(h)}</div></td>`).join("")}</tr></table>`;
}
function shell(x: Ctx, main: string, darkBody = false) {
  const b = x.brand;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${esc(x.c.headline || b.name)}</title><style>@media only screen and (max-width:620px){.email-pad{padding-left:22px!important;padding-right:22px!important}.stack{display:block!important;width:100%!important}.stack-pad{padding:0 0 18px!important}.big-type{font-size:42px!important;line-height:44px!important}.hero-title{font-size:42px!important;line-height:45px!important}.mobile-hide{display:none!important}}</style></head><body style="margin:0;padding:0;background:#ecebe7;font-family:${x.font};color:${x.text};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(x.c.previewText || x.c.headline)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ecebe7;padding:26px 10px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fff;overflow:hidden;">${main}</table></td></tr></table></body></html>`;
}
function masthead(x: Ctx, tagline = "") {
  return `<tr><td class="email-pad" style="padding:26px 38px 22px;background:#fff;border-bottom:1px solid ${x.line};"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td>${logo(x)}</td><td align="right" valign="middle" style="font-size:10px;letter-spacing:1.7px;text-transform:uppercase;color:${x.muted};">${esc(tagline || "View in browser")}</td></tr></table></td></tr>`;
}
function textBlock(x: Ctx, center = false) {
  return `<div style="font-size:16px;line-height:26px;color:${x.text};text-align:${center?"center":"left"};">${textLines(x.c.body)}</div>`;
}

function renderNewsletter(x: Ctx) {
  const image = x.c.imageUrl ?? x.brand.bannerUrl;
  const secondary = x.c.items[0];
  return shell(x,
    masthead(x,"View in browser") +
    `<tr><td style="position:relative;background:#102b28;">${image ? `<div style="position:relative;">${img(image,x.c.headline,640,430)}<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,.05));"></div><div style="position:absolute;left:42px;top:54px;right:42px;color:#fff;">` : `<div style="padding:58px 42px;color:#fff;">`}<div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${x.accent};margin-bottom:15px;">${esc(x.c.eyebrow)}</div><div class="hero-title" style="font-family:${x.font};font-size:58px;line-height:58px;font-weight:500;max-width:430px;">${esc(x.c.headline)}</div><div style="width:42px;height:2px;background:${x.accent};margin:20px 0;"></div><div style="font-size:16px;line-height:24px;max-width:370px;">${esc(x.c.body.slice(0,220))}</div><div style="margin-top:22px;">${button(x,x.c.ctaLabel,x.c.ctaUrl)}</div></div>${image?"</div>":""}</td></tr>` +
    `<tr><td class="email-pad" style="padding:34px 46px;background:#fff;text-align:center;"><div style="font-size:16px;line-height:27px;max-width:500px;margin:0 auto;color:${x.text};">${textLines(x.c.body.slice(0,360))}</div><div style="margin:30px 0 6px;">${highlights(x)}</div></td></tr>` +
    (secondary ? `<tr><td class="email-pad" style="padding:0 28px 28px;background:#fff;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${x.soft};border-radius:10px;overflow:hidden;"><tr><td class="stack" width="55%">${secondary.imageUrl?img(secondary.imageUrl,secondary.name,350,240):""}</td><td class="stack email-pad" width="45%" style="padding:28px;"><div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${x.accent};">${esc(x.c.offerLabel || "Featured")}</div><div style="font-family:${x.font};font-size:30px;line-height:32px;color:${x.primary};margin:10px 0;">${esc(secondary.name)}</div><div style="font-size:13px;line-height:20px;color:${x.muted};">${esc(secondary.description || "Discover more from our business.")}</div><div style="margin-top:16px;">${button(x,x.c.secondaryCtaLabel || "Discover more",secondary.href || x.c.ctaUrl)}</div></td></tr></table></td></tr>` : "") +
    `<tr><td>${footer(x)}</td></tr>`
  );
}

function renderWelcome(x: Ctx) {
  const recipient = x.recipient || "there";
  const image = x.c.imageUrl ?? x.brand.bannerUrl;
  return shell(x,
    masthead(x,"Comfort · hospitality · memorable experiences") +
    `<tr><td style="background:#f6f1e8;padding:34px 38px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="stack" width="50%" valign="middle" style="padding:10px 18px 10px 0;"><div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${x.muted};">${esc(x.c.eyebrow || "Hello")}</div><div style="font-family:${x.font};font-size:48px;line-height:51px;color:${x.primary};margin-top:12px;">${esc(recipient)},</div><div style="width:42px;height:2px;background:${x.accent};margin:20px 0;"></div>${textBlock(x)}<div style="font-family:cursive;font-size:30px;line-height:34px;color:${x.accent};margin:24px 0 18px;">${esc(x.c.headline)}</div></td><td class="stack" width="50%" valign="middle" style="padding:10px 0;">${image?`<div style="border-radius:8px;overflow:hidden;">${img(image,x.c.headline,290,360)}</div>`:""}</td></tr></table></td></tr>` +
    `<tr><td class="email-pad" style="padding:30px 38px;background:#fff;text-align:center;"><div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${x.muted};margin-bottom:12px;">Here’s what you can do next</div>${highlights(x)}</td></tr>` +
    `<tr><td class="email-pad" style="padding:0 28px 28px;background:#fff;">${x.c.items[0]?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${x.secondary};border-radius:8px;overflow:hidden;"><tr><td class="stack" width="52%">${x.c.items[0].imageUrl?img(x.c.items[0].imageUrl,x.c.items[0].name,330,220):""}</td><td class="stack" width="48%" style="padding:28px;color:#fff;"><div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${x.accent};">Make it yours</div><div style="font-family:${x.font};font-size:28px;line-height:31px;margin:10px 0;">${esc(x.c.items[0].name)}</div><div style="font-size:13px;line-height:20px;color:#d8e2df;">${esc(x.c.items[0].description || x.c.closingNote || "We’re here whenever you need us.")}</div><div style="margin-top:17px;">${button(x,x.c.ctaLabel,x.c.ctaUrl,true)}</div></td></tr></table>`:""}</td></tr>` +
    `<tr><td>${footer(x)}</td></tr>`
  );
}

function renderDiscount(x: Ctx) {
  const image = x.c.imageUrl ?? x.brand.bannerUrl;
  return shell(x,
    masthead(x,"Exclusive offer") +
    `<tr><td style="background:#0a1110;color:#fff;">${image?`<div style="position:relative;">${img(image,x.c.headline,640,500)}<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.88),rgba(0,0,0,.1));"></div><div style="position:absolute;left:42px;top:46px;right:42px;">`: `<div style="padding:52px 42px;">`}<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${x.accent};">${esc(x.c.eyebrow)}</div><div class="big-type" style="font-family:${x.font};font-size:60px;line-height:62px;margin-top:14px;max-width:510px;">${esc(x.c.headline)}</div><div style="width:46px;height:2px;background:${x.accent};margin:20px 0;"></div><div style="font-size:16px;line-height:25px;max-width:410px;">${esc(x.c.body.slice(0,250))}</div><div style="margin-top:22px;">${button(x,x.c.ctaLabel,x.c.ctaUrl)}</div>${x.c.offerNote?`<div style="font-size:11px;margin-top:13px;color:#d8d8d2;">${esc(x.c.offerNote)}</div>`:""}</div>${image?"</div>":""}</td></tr>` +
    `<tr><td class="email-pad" style="padding:30px 36px;background:#fff;text-align:center;"><div style="font-family:${x.font};font-size:30px;line-height:34px;color:${x.primary};margin-bottom:22px;">${esc(x.c.offerLabel || "Special offer")}</div>${highlights(x)}</td></tr>` +
    (x.c.items.length>=2 ? `<tr><td class="email-pad" style="padding:0 28px 28px;background:#fff;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${x.c.items.slice(0,2).map(i=>`<td class="stack stack-pad" width="50%" style="padding:0 5px;">${i.imageUrl?img(i.imageUrl,i.name,280,190):""}<div style="font-family:${x.font};font-size:20px;line-height:24px;color:${x.primary};margin-top:10px;">${esc(i.name)}</div>${i.price?`<div style="font-size:12px;color:${x.accent};font-weight:800;margin-top:6px;">${esc(i.price)}</div>`:""}</td>`).join("")}</tr></table></td></tr>`:"" ) +
    `<tr><td>${footer(x,true)}</td></tr>`
  );
}

function renderDiscountAlt(x: Ctx) {
  const image = x.c.imageUrl ?? x.brand.bannerUrl;
  return shell(x,
    masthead(x,"Luxury offer") +
    `<tr><td style="padding:0;background:#f5efe5;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="stack" width="53%" valign="middle" style="padding:42px 30px 40px 42px;"><div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${x.primary};">${esc(x.c.eyebrow)}</div><div style="font-family:${x.font};font-size:55px;line-height:54px;color:${x.primary};margin-top:12px;">${esc(x.c.headline)}</div><div style="width:45px;height:2px;background:${x.accent};margin:20px 0;"></div><div style="font-size:15px;line-height:24px;color:${x.text};">${esc(x.c.body.slice(0,230))}</div><div style="margin-top:20px;">${button(x,x.c.ctaLabel,x.c.ctaUrl)}</div></td><td class="stack" width="47%" valign="middle">${image?img(image,x.c.headline,300,400):""}</td></tr></table></td></tr>` +
    `<tr><td style="padding:25px 28px;background:${x.primary};color:#fff;text-align:center;">${highlights(x,true)}</td></tr>` +
    (x.c.items[0] ? `<tr><td class="email-pad" style="padding:28px;background:#fff;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="stack" width="50%">${x.c.items[0].imageUrl?img(x.c.items[0].imageUrl,x.c.items[0].name,300,220):""}</td><td class="stack" width="50%" style="padding:20px 25px;"><div style="font-family:${x.font};font-size:30px;line-height:32px;color:${x.primary};">${esc(x.c.items[0].name)}</div><div style="font-size:14px;line-height:22px;color:${x.muted};margin-top:12px;">${esc(x.c.items[0].description || "A memorable experience, now at a special rate.")}</div><div style="margin-top:18px;">${button(x,x.c.secondaryCtaLabel || x.c.ctaLabel,x.c.items[0].href || x.c.ctaUrl)}</div></td></tr></table></td></tr>` : "") +
    `<tr><td>${footer(x)}</td></tr>`
  );
}

function renderRestaurant(x: Ctx) {
  const image = x.c.imageUrl ?? x.brand.bannerUrl;
  return shell(x,
    masthead(x,"Dine · drink · celebrate") +
    `<tr><td style="background:#24150e;color:#fff;">${image?`<div style="position:relative;">${img(image,x.c.headline,640,410)}<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.78),rgba(0,0,0,.08));"></div><div style="position:absolute;left:42px;top:46px;right:42px;">`: `<div style="padding:52px 42px;">`}<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${x.accent};">${esc(x.c.eyebrow)}</div><div class="hero-title" style="font-family:${x.font};font-size:55px;line-height:56px;margin-top:12px;max-width:430px;">${esc(x.c.headline)}</div><div style="width:45px;height:2px;background:${x.accent};margin:20px 0;"></div><div style="font-size:15px;line-height:24px;max-width:420px;">${esc(x.c.body.slice(0,260))}</div><div style="margin-top:21px;">${button(x,x.c.ctaLabel,x.c.ctaUrl)}</div></div>${image?"</div>":""}</td></tr>` +
    `<tr><td class="email-pad" style="padding:34px 28px;background:#fff;text-align:center;"><div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${x.accent};">A taste of what awaits</div><div style="font-family:${x.font};font-size:34px;line-height:38px;color:${x.primary};margin:10px auto;max-width:510px;">${esc(x.c.headline)}</div><div style="font-size:15px;line-height:24px;color:${x.muted};max-width:520px;margin:0 auto 26px;">${esc(x.c.body.slice(0,220))}</div>${featuredThree(x)}</td></tr>` +
    (x.c.items[0] ? `<tr><td class="email-pad" style="padding:0 28px 28px;background:#fff;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${x.primary};border-radius:8px;overflow:hidden;"><tr><td class="stack" width="52%">${x.c.items[0].imageUrl?img(x.c.items[0].imageUrl,x.c.items[0].name,330,230):""}</td><td class="stack" width="48%" style="padding:28px;color:#fff;"><div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${x.accent};">Experience</div><div style="font-family:${x.font};font-size:27px;line-height:30px;margin:8px 0;">${esc(x.c.items[0].name)}</div><div style="font-size:13px;line-height:20px;color:#dce3df;">${esc(x.c.items[0].description || "Discover our signature experience.")}</div><div style="margin-top:16px;">${button(x,x.c.secondaryCtaLabel || "View our menu",x.c.items[0].href || x.c.ctaUrl,true)}</div></td></tr></table></td></tr>`:"" ) +
    `<tr><td>${footer(x)}</td></tr>`
  );
}

function renderAnticipation(x: Ctx) {
  const image = x.c.imageUrl ?? x.brand.bannerUrl;
  return shell(x,
    masthead(x,"Something new is coming") +
    `<tr><td style="background:#10130f;color:#fff;">${image?`<div style="position:relative;">${img(image,x.c.headline,640,430)}<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.76),rgba(0,0,0,.12));"></div><div style="position:absolute;left:42px;top:48px;right:42px;">`: `<div style="padding:58px 42px;">`}<div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${x.accent};">${esc(x.c.eyebrow)}</div><div class="hero-title" style="font-family:${x.font};font-size:58px;line-height:58px;margin-top:14px;max-width:500px;">${esc(x.c.headline)}</div><div style="width:45px;height:2px;background:${x.accent};margin:20px 0;"></div><div style="font-size:15px;line-height:24px;max-width:420px;color:#edf0ec;">${esc(x.c.body.slice(0,250))}</div></div>${image?"</div>":""}</td></tr>` +
    `<tr><td style="padding:34px 30px;background:#0b312a;color:#fff;text-align:center;"><div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${x.accent};">${esc(x.c.eventDate || "Coming soon")}</div><div style="font-family:cursive;font-size:54px;line-height:58px;margin:6px 0 16px;color:#f5e1b1;">${esc(x.c.offerLabel || "Coming Soon")}</div>${x.c.eventTime || x.c.eventLocation ? `<div style="font-size:12px;color:#d6dfda;margin-bottom:18px;">${esc(x.c.eventDate || "")}${x.c.eventTime?` &nbsp; · &nbsp; ${esc(x.c.eventTime)}`:""}${x.c.eventLocation?` &nbsp; · &nbsp; ${esc(x.c.eventLocation)}`:""}</div>`:""}${button(x,x.c.ctaLabel,x.c.ctaUrl)}</td></tr>` +
    `<tr><td class="email-pad" style="padding:28px 34px;background:#fff;text-align:center;">${highlights(x)}</td></tr>` +
    `<tr><td>${footer(x)}</td></tr>`
  );
}

export function renderMarketingEmail(template: MarketingTemplateId, brand: MarketingBrand, content: MarketingContent, opts?: { unsubscribeUrl?: string; recipientFirstName?: string; footerNote?: string; showUnsubscribe?: boolean }) {
  const c = normalizeMarketingContent(content);
  const x = ctx(brand,c,opts?.recipientFirstName);
  // The sending pipeline replaces this merge token. Keep the token in exported HTML.
  const renderer = ({ newsletter: renderNewsletter, welcome: renderWelcome, discount: renderDiscount, discount_alt: renderDiscountAlt, restaurant: renderRestaurant, anticipation: renderAnticipation } as const)[template] ?? renderNewsletter;
  let html = renderer(x);
  if (opts?.unsubscribeUrl && opts.unsubscribeUrl.startsWith("http")) html = html.replaceAll("{{unsubscribe_url}}", safeUrl(opts.unsubscribeUrl));
  if (opts?.showUnsubscribe === false) html = html.replace(/<a href="\{\{unsubscribe_url\}\}"[^>]*>Unsubscribe<\/a>/g, "").replace(/<a href="\{\{unsubscribe_url\}\}"[^>]*>Unsubscribe<\/a>\.?/g, "");
  if (opts?.footerNote) html = html.replace(/You are receiving this email because you subscribed to updates from [^<]+\./, esc(opts.footerNote));
  return html;
}
