/** Path to a page inside a store: storeHref("acme", "/cart") -> "/store/acme/cart". */
export function storeHref(slug: string, path: string = ""): string {
  // BizNest's official Browse account has no storefront: "Visit store" goes to the BizNest home page.
  if (slug === "biznest-official") return "/";
  return `/store/${slug}${path}`;
}
