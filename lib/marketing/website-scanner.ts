export type ScannedCatalogItem = {
  externalKey: string; type: string; name: string; description?: string; imageUrl?: string;
  url?: string; price?: string; salePrice?: string; currency?: string; category?: string;
  availability?: string; metadata?: Record<string, unknown>; sourceUrl: string;
};

export type WebsiteScan = {
  websiteUrl: string; businessName?: string; businessType?: string; logoUrl?: string;
  primaryColor?: string; secondaryColor?: string; description?: string;
  contactEmail?: string; contactPhone?: string; socialLinks: Record<string,string>;
  pages: { title: string; url: string }[]; items: ScannedCatalogItem[];
};

function decode(s: string) { return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function strip(s: string) { return decode(s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()); }
function attr(tag: string, name: string) { const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)`, 'i')); return m?.[1]?.trim(); }
function abs(base: URL, value?: string) { try { return value ? new URL(value, base).toString() : undefined; } catch { return undefined; } }
function safeUrl(input: string) {
  const u = new URL(input); if (!['http:','https:'].includes(u.protocol)) throw new Error('Only HTTP and HTTPS websites are supported.');
  const h = u.hostname.toLowerCase();
  if (['localhost','127.0.0.1','0.0.0.0','::1'].includes(h) || h.endsWith('.local') || h.endsWith('.internal')) throw new Error('That website address cannot be scanned.');
  if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(h) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) throw new Error('Private network addresses cannot be scanned.');
  return u;
}

export function hostOf(input: string) {
  return safeUrl(input.trim()).hostname.toLowerCase().replace(/^www\./, '');
}

// Ownership proof: the account must place a BizNest-issued token on the
// homepage (as a meta tag) or at a well-known path before the connection is
// trusted. This is what stops someone connecting a website they don't
// control -- e.g. a competitor's or a stranger's site -- to harvest its
// branding/catalog and send campaigns that impersonate that business.
export async function verifyWebsiteOwnership(input: string, token: string): Promise<boolean> {
  const base = safeUrl(input.trim());
  const check = (html: string) => html.includes(token) && (
    new RegExp(`<meta[^>]+name=["']biznest-site-verification["'][^>]+content=["']${token}["']`, 'i').test(html) ||
    new RegExp(`<meta[^>]+content=["']${token}["'][^>]+name=["']biznest-site-verification["']`, 'i').test(html)
  );
  try {
    const home = await fetch(base.toString(), { headers: { 'user-agent': 'BizNest-Marketing-Crawler/1.0 (+https://biznest.space)' }, signal: AbortSignal.timeout(10000), redirect: 'follow', cache: 'no-store' });
    if (home.ok && check((await home.text()).slice(0, 500_000))) return true;
  } catch { /* fall through to well-known file */ }
  try {
    const wellKnown = new URL('/.well-known/biznest-verify.txt', base);
    const file = await fetch(wellKnown.toString(), { signal: AbortSignal.timeout(10000), redirect: 'follow', cache: 'no-store' });
    if (file.ok && (await file.text()).trim() === token) return true;
  } catch { /* not found or unreachable */ }
  return false;
}

const FETCH_HEADERS = { 'user-agent': 'BizNest-Marketing-Crawler/1.0 (+https://biznest.space)' };

/** Pull Product/Service/Offer nodes out of a page's JSON-LD (used for the homepage and for subpages). */
function extractLdItems(html: string, pageUrl: URL): ScannedCatalogItem[] {
  const items: ScannedCatalogItem[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const raw = JSON.parse(m[1]); const nodes = Array.isArray(raw) ? raw : raw['@graph'] || [raw];
      for (const n of nodes) {
        if (!n || typeof n !== 'object') continue;
        const type = Array.isArray(n['@type']) ? n['@type'].join(',') : String(n['@type']||'');
        if (/Product|HotelRoom|Room|Service|Offer|MenuItem/i.test(type) && n.name) {
          const offers = Array.isArray(n.offers) ? n.offers[0] : n.offers;
          items.push({ externalKey: String(n.url || n['@id'] || `${type}:${n.name}`), type: /HotelRoom|Room/i.test(type) ? 'ROOM' : /Service/i.test(type) ? 'SERVICE' : 'PRODUCT', name: String(n.name), description: n.description ? String(n.description) : undefined, imageUrl: abs(pageUrl, Array.isArray(n.image) ? n.image[0] : (typeof n.image === 'object' ? n.image?.url : n.image)), url: abs(pageUrl, n.url), price: offers?.price != null ? String(offers.price) : undefined, currency: offers?.priceCurrency ? String(offers.priceCurrency) : undefined, salePrice: offers?.price != null && offers?.priceSpecification?.price ? String(offers.priceSpecification.price) : undefined, availability: offers?.availability ? String(offers.availability).split('/').pop() : undefined, category: n.category ? String(n.category) : undefined, metadata: { schemaType: type }, sourceUrl: pageUrl.toString() });
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  }
  return items;
}

// Most real-world sites (Wix, Squarespace, hand-built HTML) list their menu/products as
// plain markup, not schema.org JSON-LD -- so JSON-LD alone finds items on almost none of
// them in practice. This is a best-effort fallback: a "catalog card" reliably pairs a
// picture with a price nearby, so anchor on that pairing rather than trying to guess a
// repeating container structure without a real HTML parser.
const PRICE_RE = /(?:₦|\$|£|€|GH₵|KES|USD|NGN|GHS)\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]{1,9}(?:\.\d{1,2})?\s?(?:NGN|USD|GHS|KES|naira)\b/i;
const SKIP_IMAGE = /logo|icon|avatar|sprite|placeholder|spinner|loading|badge|banner-bg|favicon/i;

function extractGenericItems(html: string, pageUrl: URL): ScannedCatalogItem[] {
  const items: ScannedCatalogItem[] = [];
  const seen = new Set<string>();
  const IMG_RE = /<img\b[^>]*>/gi;
  const WINDOW = 700;
  let match: RegExpExecArray | null;
  while ((match = IMG_RE.exec(html)) && items.length < 40) {
    const imgTag = match[0];
    const src = attr(imgTag, 'src') || attr(imgTag, 'data-src') || attr(imgTag, 'data-lazy-src') || attr(imgTag, 'data-original');
    if (!src || SKIP_IMAGE.test(src)) continue;
    const imageUrl = abs(pageUrl, src);
    if (!imageUrl) continue;

    const before = html.slice(Math.max(0, match.index - WINDOW), match.index);
    const after = html.slice(match.index + imgTag.length, match.index + imgTag.length + WINDOW);

    // Require a nearby price -- this is what tells a product/menu card apart from a
    // hero image, a decorative photo, or an unrelated content picture.
    const priceMatch = (after.slice(0, 400).match(PRICE_RE)) || (before.slice(-200).match(PRICE_RE));
    if (!priceMatch) continue;

    const headingMatch = after.match(/<(?:h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong|b)>/i)
      || before.match(/<(?:h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong|b)>(?![\s\S]*<(?:h[1-6]|strong|b)[^>]*>)/i);
    const name = strip(headingMatch?.[1] || attr(imgTag, 'alt') || '');
    if (!name || name.length > 120 || name.length < 2) continue;

    const linkInBefore = [...before.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)].pop()?.[1];
    const linkAfter = after.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];
    const href = abs(pageUrl, linkInBefore || linkAfter);

    const key = `${imageUrl}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      externalKey: href || key,
      type: /menu|dish|food|drink/i.test(`${name} ${pageUrl.pathname}`) ? 'PRODUCT' : /service|booking|appointment|session/i.test(`${name} ${pageUrl.pathname}`) ? 'SERVICE' : 'PRODUCT',
      name,
      imageUrl,
      url: href,
      price: priceMatch[0].trim(),
      sourceUrl: pageUrl.toString(),
    });
  }
  return items;
}

export async function scanWebsite(input: string): Promise<WebsiteScan> {
  const base = safeUrl(input.trim());
  const response = await fetch(base.toString(), { headers: { 'user-agent': 'BizNest-Marketing-Crawler/1.0 (+https://biznest.space)' }, signal: AbortSignal.timeout(15000), redirect: 'follow', cache: 'no-store' });
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}.`);
  const html = (await response.text()).slice(0, 3_000_000);
  const finalUrl = new URL(response.url || base.toString());
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''));
  const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)`, 'i'))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, 'i'))?.[1];
  const canonical = abs(finalUrl, html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]);
  const text = strip(html);

  // Real theme colors come from CSS, meta tags, or manifest -- not from
  // randomly ranking whatever inline colors happen to be in the markup
  // (a page can have zero inline styles, or inline styles that belong to a
  // single unrelated element). Prefer explicit signals of the site's actual
  // brand color, in order of how deliberate they are.
  const themeColor = meta('theme-color') || html.match(/<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["'](#[0-9a-fA-F]{3,8})/i)?.[1];
  // Near-black/near-white/gray are almost always body text or background
  // defaults, not a brand color -- and without this filter the "most
  // frequent inline color" is nearly always plain black text, which isn't
  // useful (or true) as a detected brand color.
  const isNeutral = (hex: string) => {
    const h = hex.replace('#','');
    const bytes = h.length >= 6 ? [h.slice(0,2),h.slice(2,4),h.slice(4,6)] : [...h].map(c=>c+c);
    const [r,g,b] = bytes.map(x=>parseInt(x,16));
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    return (max-min) < 12; // low saturation => grayscale-ish, not a brand color
  };
  const inlineColors = [...html.matchAll(/(?:color|background-color)\s*:\s*(#[0-9a-f]{3,8})/gi)].map(m=>m[1].toLowerCase()).filter(c=>!isNeutral(c));
  const inlineColorCount = new Map<string,number>(); inlineColors.forEach(c=>inlineColorCount.set(c,(inlineColorCount.get(c)||0)+1));
  const rankedInline = [...inlineColorCount.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);

  // Known third-party artifact domains that leak into free-text email/phone
  // scraping (analytics beacons, CDN contact addresses, schema examples) --
  // excluded so we don't hand back noise as if it were the business's own
  // contact details.
  const NOISE_EMAIL_DOMAINS = /(sentry\.io|wixpress\.com|googleapis\.com|google-analytics\.com|cloudflare\.com|schema\.org|example\.com|w3\.org|gstatic\.com|doubleclick\.net)$/i;

  const ldItems: ScannedCatalogItem[] = [];
  let orgName: string | undefined, orgLogo: string | undefined, orgDescription: string | undefined, orgEmail: string | undefined, orgPhone: string | undefined, orgType: string | undefined;
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const raw = JSON.parse(m[1]); const nodes = Array.isArray(raw) ? raw : raw['@graph'] || [raw];
      for (const n of nodes) {
        if (!n || typeof n !== 'object') continue;
        const type = Array.isArray(n['@type']) ? n['@type'].join(',') : String(n['@type']||'');
        // Organization/LocalBusiness nodes carry the site's own verified
        // identity -- far more reliable than guessing from <title>.
        if (/Organization|LocalBusiness|Hotel|Restaurant|Corporation/i.test(type)) {
          orgName ||= n.name ? String(n.name) : undefined;
          orgType ||= /Hotel/i.test(type) ? 'Hotel' : /Restaurant/i.test(type) ? 'Restaurant' : undefined;
          orgLogo ||= typeof n.logo === 'string' ? n.logo : n.logo?.url ? String(n.logo.url) : undefined;
          orgDescription ||= n.description ? String(n.description) : undefined;
          orgEmail ||= n.email ? String(n.email) : (n.contactPoint?.email ? String(n.contactPoint.email) : undefined);
          orgPhone ||= n.telephone ? String(n.telephone) : (n.contactPoint?.telephone ? String(n.contactPoint.telephone) : undefined);
        }
        if (/Product|HotelRoom|Room|Service|Offer/i.test(type) && n.name) {
          const offers = Array.isArray(n.offers) ? n.offers[0] : n.offers;
          ldItems.push({ externalKey: String(n.url || n['@id'] || `${type}:${n.name}`), type: /HotelRoom|Room/i.test(type) ? 'ROOM' : /Service/i.test(type) ? 'SERVICE' : 'PRODUCT', name: String(n.name), description: n.description ? String(n.description) : undefined, imageUrl: Array.isArray(n.image) ? n.image[0] : n.image, url: abs(finalUrl, n.url), price: offers?.price != null ? String(offers.price) : undefined, currency: offers?.priceCurrency ? String(offers.priceCurrency) : undefined, salePrice: offers?.price != null && offers?.priceSpecification?.price ? String(offers.priceSpecification.price) : undefined, availability: offers?.availability ? String(offers.availability).split('/').pop() : undefined, category: n.category ? String(n.category) : undefined, metadata: { schemaType:type }, sourceUrl: finalUrl.toString() });
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  }

  // Logo: prefer a source that actually claims to BE the logo (JSON-LD,
  // og:image, a real <link rel="icon">) over guessing from any <img> whose
  // class/src merely contains the word "logo" (false positives are common --
  // decorative icons, unrelated partner badges, etc).
  const iconHref = html.match(/<link[^>]+rel=["'](?:apple-touch-icon|icon|mask-icon|shortcut icon)["'][^>]+href=["']([^"']+)/i)?.[1]
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:apple-touch-icon|icon|mask-icon|shortcut icon)["']/i)?.[1];
  const logoTag = html.match(/<img[^>]+(?:logo|brand)[^>]*>/i)?.[0];
  // Some sites style the logo as a background-image on a "logo"/"brand"
  // element rather than an <img> tag (common with SPA/component frameworks) --
  // catch that pattern too before giving up on inline markup entirely.
  const logoBgTag = html.match(/<[^>]+class=["'][^"']*(?:logo|brand)[^"']*["'][^>]*style=["'][^"']*background(?:-image)?\s*:[^"']*url\(([^)'"]+)/i)?.[1];
  // Fallback for sites whose header image carries no "logo"/"brand" keyword
  // at all (e.g. `<a href="/"><img src="..."> Business Name</a>` inside a
  // plain <header>/<nav>) -- the very first <img> that appears inside the
  // page's <header> or <nav>, before any other content, is almost always
  // the site's own logo even when nothing in its markup says so explicitly.
  const headerMarkup = html.match(/<(?:header|nav)\b[^>]*>[\s\S]{0,4000}?<\/(?:header|nav)>/i)?.[0] ?? html.slice(0, 4000);
  const headerImgTag = headerMarkup.match(/<img\b[^>]*>/i)?.[0];

  // None of the signals above are proof the URL actually resolves to a
  // loadable image -- a stale og:image, a moved logo file, or a
  // false-positive "logo" class match all produce a URL that 404s or
  // redirects to an HTML error page, which then shows as a broken image
  // everywhere the connector/email designer renders it. So probe each
  // candidate, in order of trustworthiness, and keep the first one that
  // actually comes back as image content -- rather than trusting whichever
  // regex happened to match first and saving a link that never loads.
  //
  // A strict `content-type starts with "image"` check is too strict for
  // some storage/CDN backends (Supabase Storage among them) that serve a
  // perfectly valid, browser-renderable image under a generic
  // application/octet-stream or binary/octet-stream content-type when the
  // file was uploaded without explicit content-type metadata. Browsers
  // don't care and render it fine; our probe was rejecting it and treating
  // a genuinely working logo as unreachable. So also accept a generic
  // binary content-type when the URL's own extension is a known image
  // format -- the same signal a browser effectively falls back on.
  const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|ico|avif|bmp)(?:[?#]|$)/i;
  const looksLikeImage = (contentType: string, url: string) =>
    contentType.startsWith('image') || (/^(application|binary)\/octet-stream$/i.test(contentType) && IMAGE_EXT.test(url));

  const logoCandidates = [
    abs(finalUrl, orgLogo),
    abs(finalUrl, meta('og:image')),
    abs(finalUrl, attr(logoTag || '', 'src')),
    abs(finalUrl, headerImgTag ? attr(headerImgTag, 'src') : undefined),
    abs(finalUrl, iconHref),
    abs(finalUrl, logoBgTag),
  ].filter((u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i);

  let logoUrl: string | undefined;
  for (const candidate of logoCandidates.slice(0, 6)) {
    try {
      const probe = await fetch(candidate, { method: 'GET', headers: { 'user-agent': 'BizNest-Marketing-Crawler/1.0 (+https://biznest.space)' }, signal: AbortSignal.timeout(8000), redirect: 'follow', cache: 'no-store' });
      if (probe.ok && looksLikeImage(probe.headers.get('content-type') || '', candidate)) { logoUrl = candidate; break; }
    } catch { /* candidate unreachable -- try the next one */ }
  }
  if (!logoUrl) {
    // Last resort: the path browsers themselves fall back to when no <link
    // rel="icon"> is declared at all. Verify it actually resolves first --
    // an unchecked guess that 404s would show as a broken image in the
    // connector UI, which is worse than the clean "no logo" placeholder.
    try {
      const candidate = new URL('/favicon.ico', finalUrl);
      const probe = await fetch(candidate.toString(), { method: 'GET', signal: AbortSignal.timeout(8000), redirect: 'follow', cache: 'no-store' });
      if (probe.ok && looksLikeImage(probe.headers.get('content-type') || '', candidate.toString())) logoUrl = candidate.toString();
    } catch { /* no favicon.ico available */ }
  }


  // Contact info: a mailto:/tel: link is an explicit, deliberate contact
  // channel the site published -- far more trustworthy than free-text
  // regex matches, which pick up tracking-pixel addresses, example emails
  // in scripts, or any phone-shaped number on the page.
  const mailtoEmails = [...new Set([...html.matchAll(/href=["']mailto:([^"'?]+)/gi)].map(m=>m[1].toLowerCase()))].filter(e=>!NOISE_EMAIL_DOMAINS.test(e.split('@')[1]||''));
  const telPhones = [...new Set([...html.matchAll(/href=["']tel:([^"']+)/gi)].map(m=>m[1]))];
  const freeTextEmails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])].filter(e=>!NOISE_EMAIL_DOMAINS.test(e.split('@')[1]||''));
  const freeTextPhones = [...new Set(text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [])].slice(0,5);
  const contactEmail = orgEmail || mailtoEmails[0] || freeTextEmails[0];
  const contactPhone = orgPhone || telPhones[0] || freeTextPhones[0];

  const socialLinks: Record<string,string> = {};
  for (const [key, re] of Object.entries({ instagram:/instagram\.com\/[A-Za-z0-9_.-]+/i, facebook:/facebook\.com\/[A-Za-z0-9_.-]+/i, tiktok:/tiktok\.com\/@?[A-Za-z0-9_.-]+/i, linkedin:/linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.-]+/i })) {
    const m = html.match(new RegExp(`https?:\\/\\/[^"'\\s<>]*${re.source}`, 'i')); if (m) socialLinks[key] = m[0];
  }

  const pages = [{ title: title || finalUrl.hostname, url: canonical || finalUrl.toString() }];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const u = abs(finalUrl, m[1]); const label = strip(m[2]);
    if (u && label && new URL(u).hostname === finalUrl.hostname && /product|room|suite|service|menu|shop|offer|sale|pricing/i.test(`${label} ${u}`)) pages.push({title:label.slice(0,100),url:u});
  }
  const uniquePages = [...new Map(pages.map(p=>[p.url,p])).values()].slice(0,50);

  // Catalog items: JSON-LD on the homepage rarely covers the actual menu/shop, which
  // usually lives on its own page -- so crawl the few candidate pages already
  // identified above (product/menu/shop/service links) and pull items from each,
  // falling back to the generic image+price scraper wherever a page has no JSON-LD.
  const homepageLdItems = ldItems;
  const homepageItems = homepageLdItems.length ? homepageLdItems : extractGenericItems(html, finalUrl);
  const candidatePages = uniquePages.filter(p => p.url !== finalUrl.toString() && p.url !== (canonical || '')).slice(0, 5);
  const subpageItemLists = await Promise.all(candidatePages.map(async (p) => {
    try {
      const res = await fetch(p.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(10000), redirect: 'follow', cache: 'no-store' });
      if (!res.ok) return [];
      const subHtml = (await res.text()).slice(0, 2_000_000);
      const subUrl = new URL(res.url || p.url);
      const subLd = extractLdItems(subHtml, subUrl);
      return subLd.length ? subLd : extractGenericItems(subHtml, subUrl);
    } catch { return []; }
  }));
  const allItems = [...new Map([...homepageItems, ...subpageItemLists.flat()].map(i => [i.externalKey, i])).values()].slice(0, 200);

  // Business name: an explicitly-declared identity (JSON-LD, og:site_name)
  // beats guessing from <title>, which is often "Page Title | Site Name" or
  // "Site Name - Tagline" in either order -- pick whichever split segment
  // looks like a name (shorter, no stopwords) rather than blindly taking
  // the first one.
  const titleParts = title.split(/[|\-–—]/).map(s=>s.trim()).filter(Boolean);
  const bestTitlePart = titleParts.sort((a,b)=>a.length-b.length)[0];
  const businessName = orgName || meta('og:site_name') || bestTitlePart || title || undefined;

  // Business type: a site's own declared schema type is real signal.
  // Guessing from keywords is only trustworthy against title+meta (text the
  // site deliberately wrote about itself), not the full page body, which
  // includes nav/footer/blog content where an incidental word match (e.g.
  // "suite" in an unrelated sentence) produces a wrong label. Word
  // boundaries avoid matching inside unrelated words.
  const ownWords = `${title} ${meta('description')||''} ${meta('og:title')||''}`;
  const classify = (s: string) =>
    /\bhotel\b|\bresort\b|\blodge\b/i.test(s) ? 'Hotel' :
    /\brestaurant\b|\bmenu\b|\bdining\b|\bcaf[eé]\b/i.test(s) ? 'Restaurant' :
    /\breal estate\b|\bproperty\b|\bapartments?\b/i.test(s) ? 'Real Estate' :
    /\bshop\b|\bcart\b|\badd to cart\b/i.test(s) ? 'E-commerce' : undefined;
  const businessType = orgType || classify(ownWords) || classify(text) || undefined;

  return {
    websiteUrl: finalUrl.toString(),
    businessName,
    businessType,
    logoUrl,
    primaryColor: themeColor || rankedInline[0],
    // Only report a second color if we actually found a genuinely different
    // one -- duplicating the primary as a fake "secondary" is worse than
    // just leaving it unset.
    secondaryColor: rankedInline.find(c=>c!==themeColor && c!==rankedInline[0]) || (themeColor ? rankedInline[0] : undefined),
    description: orgDescription || meta('description') || undefined,
    contactEmail,
    contactPhone,
    socialLinks,
    pages: uniquePages,
    items: allItems,
  };
}