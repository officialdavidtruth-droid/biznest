/** Path to a page inside a store: storeHref("acme", "/cart") -> "/store/acme/cart". */
export function storeHref(slug: string, path: string = ""): string {
  return `/store/${slug}${path}`;
}
