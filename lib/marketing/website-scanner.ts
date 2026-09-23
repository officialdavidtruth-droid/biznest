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

export async function scanWebsite(input: string): Promise<WebsiteScan> {
  const base = safeUrl(input.trim());
  const response = await fetch(base.toString(), { headers: { 'user-agent': 'BizNest-Marketing-Crawler/1.0 (+https://biznest.space)' }, signal: AbortSignal.timeout(15000), redirect: 'follow', cache: 'no-store' });
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}.`);
  const html = (await response.text()).slice(0, 3_000_000);
  const finalUrl = new URL(response.url || base.toString());
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''));
  const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)`, 'i'))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, 'i'))?.[1];
  const logoTag = html.match(/<img[^>]+(?:logo|brand)[^>]*>/i)?.[0];
  const logoUrl = abs(finalUrl, attr(logoTag || '', 'src'));
  const canonical = abs(finalUrl, html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]);
  const text = strip(html);
  const emails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])];
  const phones = [...new Set(text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [])].slice(0,5);
  const socialLinks: Record<string,string> = {};
  for (const [key, re] of Object.entries({ instagram:/instagram\.com\/[A-Za-z0-9_.-]+/i, facebook:/facebook\.com\/[A-Za-z0-9_.-]+/i, tiktok:/tiktok\.com\/@?[A-Za-z0-9_.-]+/i, linkedin:/linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.-]+/i })) {
    const m = html.match(new RegExp(`https?:\\/\\/[^"'\\s<>]*${re.source}`, 'i')); if (m) socialLinks[key] = m[0];
  }
  const colors = [...html.matchAll(/(?:color|background-color)\s*:\s*(#[0-9a-f]{3,8})/gi)].map(m=>m[1].toLowerCase());
  const colorCount = new Map<string,number>(); colors.forEach(c=>colorCount.set(c,(colorCount.get(c)||0)+1));
  const ranked = [...colorCount.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const ldItems: ScannedCatalogItem[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const raw = JSON.parse(m[1]); const nodes = Array.isArray(raw) ? raw : raw['@graph'] || [raw];
      for (const n of nodes) {
        if (!n || typeof n !== 'object') continue;
        const type = Array.isArray(n['@type']) ? n['@type'].join(',') : String(n['@type']||'');
        if (/Product|HotelRoom|Room|Service|Offer/i.test(type) && n.name) {
          const offers = Array.isArray(n.offers) ? n.offers[0] : n.offers;
          ldItems.push({ externalKey: String(n.url || n['@id'] || `${type}:${n.name}`), type: /HotelRoom|Room/i.test(type) ? 'ROOM' : /Service/i.test(type) ? 'SERVICE' : 'PRODUCT', name: String(n.name), description: n.description ? String(n.description) : undefined, imageUrl: Array.isArray(n.image) ? n.image[0] : n.image, url: abs(finalUrl, n.url), price: offers?.price != null ? String(offers.price) : undefined, currency: offers?.priceCurrency ? String(offers.priceCurrency) : undefined, salePrice: offers?.price != null && offers?.priceSpecification?.price ? String(offers.priceSpecification.price) : undefined, availability: offers?.availability ? String(offers.availability).split('/').pop() : undefined, category: n.category ? String(n.category) : undefined, metadata: { schemaType:type }, sourceUrl: finalUrl.toString() });
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  }
  const pages = [{ title: title || finalUrl.hostname, url: canonical || finalUrl.toString() }];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const u = abs(finalUrl, m[1]); const label = strip(m[2]);
    if (u && label && new URL(u).hostname === finalUrl.hostname && /product|room|suite|service|menu|shop|offer|sale|pricing/i.test(`${label} ${u}`)) pages.push({title:label.slice(0,100),url:u});
  }
  const uniquePages = [...new Map(pages.map(p=>[p.url,p])).values()].slice(0,50);
  return { websiteUrl: finalUrl.toString(), businessName: meta('og:site_name') || title.split('|')[0].split('-')[0].trim() || undefined, businessType: /hotel|suite|resort/i.test(text) ? 'Hotel' : /restaurant|menu|dining/i.test(text) ? 'Restaurant' : /real estate|property|apartment/i.test(text) ? 'Real Estate' : /shop|cart|product|add to cart/i.test(text) ? 'E-commerce' : 'Professional Services', logoUrl, primaryColor: ranked[0], secondaryColor: ranked[1], description: meta('description') || undefined, contactEmail: emails[0], contactPhone: phones[0], socialLinks, pages: uniquePages, items: [...new Map(ldItems.map(i=>[i.externalKey,i])).values()].slice(0,200) };
}
