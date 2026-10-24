# BizNest SEO — what was added and what you must do after deploying

## Added in code
- `app/robots.ts` – /robots.txt (blocks admin, checkout, cart, account, API; points to the sitemap)
- `app/sitemap.ts` – /sitemap.xml (home, templates, browse, legal, every active store, product, service, category), refreshed hourly
- `app/store/[slug]/sitemap.xml` + `robots.txt` – per-store versions that serve on a vendor's verified custom domain
- Root metadata: metadataBase, keywords, Open Graph/Twitter, robots, Google/Bing verification, default share image (`app/opengraph-image.tsx`)
- Homepage: keyword title, canonical, Organization + WebSite JSON-LD
- Store home: title/description from the SEO app (with smart defaults), canonical (custom domain aware), OG image, LocalBusiness JSON-LD
- Product / service / category pages: unique titles, descriptions, canonicals, OG; Product / Service / BreadcrumbList JSON-LD; unpublished items no longer leak via metadata
- `next.config.js`: `X-Robots-Tag: noindex` on all private pages

## After deploying (cannot be done from code)
1. Google Search Console → add `https://www.biznest.space` (URL-prefix) → HTML tag → put the content value in `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` → redeploy → Verify.
2. Search Console → Sitemaps → submit `sitemap.xml`. Then URL Inspection → Request indexing for the homepage.
3. Bing Webmaster Tools → import from Search Console (or use `NEXT_PUBLIC_BING_SITE_VERIFICATION`) → submit the sitemap. Bing also feeds DuckDuckGo/Yahoo.
4. Make sure `NEXT_PUBLIC_APP_URL` is the one canonical host (www vs. apex) and redirect the other to it in Vercel.
5. Test: https://search.google.com/test/rich-results on a product URL.
6. Rankings take weeks; real content (store descriptions, product descriptions, backlinks) matters as much as the technical setup.
