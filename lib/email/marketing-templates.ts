export type MarketingTemplateId =
  | "announcement"
  | "showcase"
  | "promotion"
  | "newsletter"
  | "service"
  | "hospitality";

export type MarketingItem = {
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

export type MarketingContent = {
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl?: string;
  items: MarketingItem[];
  previewText?: string;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.space";

export const MARKETING_TEMPLATES: Array<{
  id: MarketingTemplateId;
  name: string;
  description: string;
  icon: string;
}> = [
  { id: "announcement", name: "Big announcement", description: "Bold hero, story block and CTA for launches and news.", icon: "✦" },
  { id: "showcase", name: "Product showcase", description: "Image-led cards for products, collections and best sellers.", icon: "▦" },
  { id: "promotion", name: "Offer / promotion", description: "High-impact sale layout with a strong offer and CTA.", icon: "%" },
  { id: "newsletter", name: "Monthly newsletter", description: "Editorial layout for updates, tips, stories and multiple links.", icon: "✉" },
  { id: "service", name: "Service spotlight", description: "Perfect for salons, agencies, restaurants and appointment businesses.", icon: "◉" },
  { id: "hospitality", name: "Hotel / booking", description: "Reservation-style layout with property imagery, dates and booking CTA.", icon: "⌂" },
];

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value: string | undefined | null, fallback = APP_URL) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  try {
    const u = new URL(raw, APP_URL);
    if (["http:", "https:"].includes(u.protocol)) return u.toString();
  } catch {}
  return fallback;
}

function firstHex(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value ?? "") ? value! : fallback;
}

function readableOn(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111827" : "#ffffff";
}

function button(label: string, href: string, color: string, textColor: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:10px;background:${color};"><a href="${safeUrl(href)}" style="display:inline-block;padding:14px 24px;border-radius:10px;color:${textColor};font-size:14px;font-weight:800;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
}

function image(src: string | undefined | null, alt: string, width = "100%") {
  if (!src) return "";
  return `<img src="${safeUrl(src)}" alt="${esc(alt)}" width="${width === "100%" ? "600" : "280"}" style="display:block;width:${width};height:auto;border:0;outline:none;text-decoration:none;${width === "100%" ? "border-radius:14px;" : "border-radius:10px;"}" />`;
}

function itemCards(items: MarketingItem[], brand: MarketingBrand, cols = 2) {
  const visible = items.slice(0, cols === 2 ? 4 : 3);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${visible.map((item, index) => `<td width="${Math.floor(100 / cols)}%" valign="top" style="padding:${index % cols === 0 ? "0 8px 16px 0" : "0 0 16px 8px"};"> <a href="${safeUrl(item.href, `${APP_URL}/${brand.slug}`)}" style="text-decoration:none;color:${brand.text};">${image(item.imageUrl, item.name)}<div style="padding-top:10px;font-size:15px;font-weight:800;">${esc(item.name)}</div>${item.description ? `<div style="padding-top:5px;color:#6b7280;font-size:12px;line-height:18px;">${esc(item.description).slice(0, 150)}</div>` : ""}${item.price ? `<div style="padding-top:8px;color:${brand.primary};font-size:14px;font-weight:800;">${esc(item.price)}</div>` : ""}</a></td>`).join("")}</tr></table>`;
}

function social(brand: MarketingBrand) {
  const links = Object.entries(brand.socialLinks ?? {}).filter(([, v]) => v).slice(0, 5);
  if (!links.length) return "";
  return `<div style="margin-top:14px;">${links.map(([name, url]) => `<a href="${safeUrl(url)}" style="display:inline-block;margin-right:12px;color:${brand.primary};font-size:12px;text-decoration:none;">${esc(name)}</a>`).join("")}</div>`;
}

export function defaultMarketingContent(template: MarketingTemplateId, brand: MarketingBrand, items: MarketingItem[]): MarketingContent {
  const type = (brand.businessType ?? "").toLowerCase();
  const hospitality = /hotel|lodging|hospitality|resort|guest/.test(type);
  const food = /restaurant|food|cafe|bakery|bar|catering/.test(type);
  const beauty = /salon|barber|spa|beauty|nail/.test(type);
  const professional = /agency|consult|studio|photography|creative|service/.test(type);

  if (template === "promotion") return {
    eyebrow: hospitality ? "LIMITED STAY OFFER" : food ? "THIS WEEK ONLY" : "LIMITED-TIME OFFER",
    headline: hospitality ? "Make your next stay feel special." : beauty ? "A little self-care goes a long way." : "Something special is waiting for you.",
    body: hospitality ? "Enjoy a memorable stay with a thoughtful offer from our team. Reserve while availability lasts." : food ? "Treat yourself to something delicious. Discover this week’s featured picks and enjoy a special offer.": "We put together a special offer for our community. Take a look before it ends.",
    ctaLabel: hospitality ? "BOOK YOUR STAY" : "SHOP THE OFFER",
    ctaUrl: `${APP_URL}/${brand.slug}`,
    imageUrl: brand.bannerUrl ?? items[0]?.imageUrl,
    items: items.slice(0, 3),
  };
  if (template === "service" || (!brand.sellsProducts && brand.offersServices)) return {
    eyebrow: beauty ? "YOUR NEXT APPOINTMENT" : professional ? "WHAT WE DO" : "FEATURED SERVICE",
    headline: beauty ? "Ready for your next appointment?" : "Let’s make your next project easier.",
    body: beauty ? "Explore our services, choose what fits you and book directly from our website." : brand.businessDescription ?? "Discover a service designed around your goals, your schedule and your experience.",
    ctaLabel: beauty ? "BOOK NOW" : "EXPLORE SERVICES",
    ctaUrl: `${APP_URL}/${brand.slug}`,
    imageUrl: items[0]?.imageUrl ?? brand.bannerUrl,
    items: items.slice(0, 3),
  };
  if (template === "hospitality" || hospitality) return {
    eyebrow: "WELCOME TO " + brand.name.toUpperCase(),
    headline: "Your stay, beautifully considered.",
    body: "See our rooms, amenities and availability, then reserve your preferred stay in a few clicks.",
    ctaLabel: "VIEW ROOMS & BOOK",
    ctaUrl: `${APP_URL}/${brand.slug}`,
    imageUrl: brand.bannerUrl ?? items[0]?.imageUrl,
    items: items.slice(0, 3),
  };
  if (template === "showcase") return {
    eyebrow: food ? "FROM OUR KITCHEN" : "FEATURED PICKS",
    headline: food ? "Good things are on the menu." : "A few things we think you’ll love.",
    body: "Hand-picked from our latest collection. Tap any item to see the full details.",
    ctaLabel: brand.sellsProducts ? "VIEW EVERYTHING" : "LEARN MORE",
    ctaUrl: `${APP_URL}/${brand.slug}`,
    imageUrl: items[0]?.imageUrl ?? brand.bannerUrl,
    items: items.slice(0, 4),
  };
  if (template === "newsletter") return {
    eyebrow: "FROM " + brand.name.toUpperCase(),
    headline: "A quick update from our business.",
    body: brand.businessDescription ?? "Here are the latest things happening at our business, plus a few useful picks for you.",
    ctaLabel: "VISIT OUR WEBSITE",
    ctaUrl: `${APP_URL}/${brand.slug}`,
    imageUrl: brand.bannerUrl ?? items[0]?.imageUrl,
    items: items.slice(0, 4),
  };
  return {
    eyebrow: "A NOTE FROM " + brand.name.toUpperCase(),
    headline: "We have something new for you.",
    body: brand.businessDescription ?? "Stay close to what’s new, what’s useful and what’s worth your attention.",
    ctaLabel: "EXPLORE NOW",
    ctaUrl: `${APP_URL}/${brand.slug}`,
    imageUrl: brand.bannerUrl ?? items[0]?.imageUrl,
    items: items.slice(0, 3),
  };
}

export function renderMarketingEmail(
  template: MarketingTemplateId,
  brand: MarketingBrand,
  content: MarketingContent,
  opts?: { unsubscribeUrl?: string; recipientFirstName?: string }
) {
  const primary = firstHex(brand.primary, "#111827");
  const secondary = firstHex(brand.secondary, "#111827");
  const accent = firstHex(brand.accent, primary);
  const background = firstHex(brand.background, "#f3f4f6");
  const text = firstHex(brand.text, "#111827");
  const onPrimary = readableOn(primary);
  const greeting = opts?.recipientFirstName ? `Hi ${esc(opts.recipientFirstName)},` : "Hello,";
  const unsub = safeUrl(opts?.unsubscribeUrl, `${APP_URL}/${brand.slug}`);

  let main = "";
  if (template === "promotion") {
    main = `<div style="padding:34px 34px 28px;background:${primary};color:${onPrimary};text-align:center;">${content.imageUrl ? image(content.imageUrl, content.headline) : ""}<div style="margin-top:24px;font-size:11px;font-weight:900;letter-spacing:2px;opacity:.8;">${esc(content.eyebrow)}</div><h1 style="margin:12px 0 12px;font-size:34px;line-height:1.05;letter-spacing:-1px;">${esc(content.headline)}</h1><p style="margin:0 auto 22px;max-width:500px;font-size:15px;line-height:24px;opacity:.9;">${esc(content.body)}</p><div style="display:inline-block;">${button(content.ctaLabel, content.ctaUrl, accent, readableOn(accent))}</div></div>${content.items.length ? `<div style="padding:28px 34px;">${itemCards(content.items, brand, 2)}</div>` : ""}`;
  } else if (template === "showcase") {
    main = `<div style="padding:34px 34px 22px;"><div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${primary};">${esc(content.eyebrow)}</div><h1 style="margin:10px 0 12px;font-size:32px;line-height:1.08;letter-spacing:-1px;color:${text};">${esc(content.headline)}</h1><p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:24px;">${esc(content.body)}</p>${content.imageUrl ? `<div style="margin-bottom:26px;">${image(content.imageUrl, content.headline)}</div>` : ""}${itemCards(content.items, brand, 2)}<div style="margin-top:8px;">${button(content.ctaLabel, content.ctaUrl, primary, onPrimary)}</div></div>`;
  } else if (template === "hospitality") {
    main = `<div style="padding:34px 34px 28px;"><div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${primary};">${esc(content.eyebrow)}</div><h1 style="margin:10px 0 10px;font-size:32px;line-height:1.08;color:${text};">${esc(content.headline)}</h1><p style="margin:0 0 22px;color:#6b7280;font-size:15px;line-height:24px;">${esc(content.body)}</p>${content.imageUrl ? `<div style="margin-bottom:24px;">${image(content.imageUrl, brand.name)}</div>` : ""}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:24px;"><tr><td style="padding:16px 8px 16px 0;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Check in</div><strong style="font-size:15px;">Choose your date</strong></td><td style="padding:16px 0 16px 8px;text-align:right;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Rooms</div><strong style="font-size:15px;">Explore availability</strong></td></tr></table>${itemCards(content.items, brand, 1)}${button(content.ctaLabel, content.ctaUrl, primary, onPrimary)}</div>`;
  } else if (template === "service") {
    main = `<div style="padding:34px 34px 28px;"><div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${primary};">${esc(content.eyebrow)}</div><h1 style="margin:10px 0 12px;font-size:32px;line-height:1.08;color:${text};">${esc(content.headline)}</h1><p style="margin:0 0 22px;color:#6b7280;font-size:15px;line-height:24px;">${esc(content.body)}</p>${content.imageUrl ? `<div style="margin-bottom:24px;">${image(content.imageUrl, content.headline)}</div>` : ""}<div style="background:${background};border-radius:14px;padding:18px;">${content.items.map((item) => `<div style="padding:12px 0;border-bottom:1px solid rgba(0,0,0,.08);"><strong style="font-size:15px;">${esc(item.name)}</strong>${item.description ? `<div style="margin-top:4px;color:#6b7280;font-size:12px;line-height:18px;">${esc(item.description)}</div>` : ""}${item.price ? `<div style="margin-top:5px;color:${primary};font-weight:800;font-size:13px;">${esc(item.price)}</div>` : ""}</div>`).join("")}</div><div style="margin-top:24px;">${button(content.ctaLabel, content.ctaUrl, primary, onPrimary)}</div></div>`;
  } else {
    main = `<div style="padding:34px 34px 28px;">${content.imageUrl ? `<div style="margin-bottom:24px;">${image(content.imageUrl, content.headline)}</div>` : ""}<div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${primary};">${esc(content.eyebrow)}</div><h1 style="margin:10px 0 12px;font-size:32px;line-height:1.08;color:${text};">${esc(content.headline)}</h1><p style="margin:0 0 12px;color:${text};font-size:15px;line-height:25px;">${greeting}</p><p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:25px;">${esc(content.body)}</p>${content.items.length ? `<div style="margin-bottom:10px;">${itemCards(content.items, brand, 2)}</div>` : ""}${button(content.ctaLabel, content.ctaUrl, primary, onPrimary)}</div>`;
  }

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;padding:0;background:${background};font-family:${esc(brand.fontFamily)},Arial,Helvetica,sans-serif;color:${text};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(content.previewText ?? content.headline)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${background};padding:28px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;"><tr><td style="padding:20px 28px;border-bottom:1px solid #eeeeee;background:#ffffff;"><table role="presentation" width="100%"><tr><td valign="middle">${brand.logoUrl ? `<img src="${safeUrl(brand.logoUrl)}" alt="${esc(brand.name)}" height="36" style="display:block;max-width:180px;height:36px;width:auto;object-fit:contain;" />` : `<div style="font-size:20px;font-weight:900;color:${primary};">${esc(brand.name)}</div>`}</td><td align="right" style="font-size:11px;font-weight:700;color:#9ca3af;">${esc(brand.businessType ?? "BUSINESS")}</td></tr></table></td></tr><tr><td>${main}</td></tr><tr><td style="padding:22px 30px 26px;background:${secondary};color:${readableOn(secondary)};"><div style="font-size:13px;font-weight:800;">${esc(brand.name)}</div>${brand.contactEmail ? `<div style="margin-top:5px;font-size:11px;opacity:.75;">${esc(brand.contactEmail)}${brand.contactPhone ? ` · ${esc(brand.contactPhone)}` : ""}</div>` : ""}${social(brand)}<div style="margin-top:16px;font-size:10px;line-height:16px;opacity:.65;">You are receiving this email because you subscribed to updates from ${esc(brand.name)}. <a href="${unsub}" style="color:inherit;text-decoration:underline;">Unsubscribe</a>.</div><div style="margin-top:7px;font-size:10px;opacity:.5;">Powered by BizNest</div></td></tr></table></td></tr></table></body></html>`;
}
