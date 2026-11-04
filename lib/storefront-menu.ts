// Shared (server + client safe) types and helpers for the owner-managed
// storefront header menu. No imports from prisma here on purpose, so the
// client MenuLinks component can import the types without bundling the DB.

export type MenuLinkType = "PAGE" | "CATEGORY" | "CUSTOM";

export type ResolvedMenuItem = {
  id: string;
  label: string;
  href: string;
  external: boolean;
  newTab: boolean;
  children: ResolvedMenuItem[];
};

export type StoredMenuRow = {
  id: string;
  label: string;
  linkType: string;
  target: string | null;
  openInNewTab: boolean;
  parentId: string | null;
  sortOrder: number;
};

// Pages every storefront already serves under /store/[slug]/... The owner
// picks from these (or a category, or a custom URL) when building the menu.
export const MENU_PAGE_OPTIONS: { label: string; path: string }[] = [
  { label: "Home", path: "/" },
  { label: "All items / Catalog", path: "/catalog" },
  { label: "Rooms", path: "/rooms" },
  { label: "Amenities", path: "/amenities" },
  { label: "Dining", path: "/dining" },
  { label: "Gallery", path: "/gallery" },
  { label: "About", path: "/about" },
  { label: "Blog", path: "/blog" },
  { label: "Events", path: "/events" },
  { label: "Offers", path: "/offers" },
  { label: "Deals", path: "/deals" },
  { label: "New arrivals", path: "/new-arrivals" },
  { label: "Brands", path: "/brands" },
  { label: "Portfolio", path: "/portfolio" },
  { label: "Services", path: "/services" },
  { label: "Pricing / Packages", path: "/pricing" },
  { label: "FAQ", path: "/faq" },
  { label: "Policies", path: "/policies" },
  { label: "Reservations", path: "/reservations" },
  { label: "Support", path: "/support" },
  { label: "Book now", path: "/book" },
  { label: "Contact", path: "/contact" },
  { label: "Cart", path: "/cart" },
  { label: "Orders", path: "/orders" },
  { label: "Account", path: "/account" },
];

export function storePath(slug: string, path = "/") {
  const clean = path === "/" || path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/store/${slug}${clean}`;
}

/** Only allow safe link targets for owner-typed custom URLs. */
export function sanitizeCustomUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("/") || v.startsWith("#")) return v;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
  return null;
}

/**
 * `categories` is the store's ACTIVE categories. It does two things for CATEGORY menu items:
 *  - links them to the readable /category/<slug> address (the menu stores the category id, so renaming a category
 *    never breaks the menu);
 *  - hides items whose category was deleted or switched off, instead of showing a link that 404s. If such an item
 *    has dropdown children, those move up to the top level so the owner's other links don't vanish with it.
 * Leave `categories` undefined to skip both (previews, tests); pass [] for a store that has no active categories.
 */
export function resolveMenuRows(rows: StoredMenuRow[], slug: string, categories?: { id: string; slug?: string | null }[]): ResolvedMenuItem[] {
  const categorySlugById = categories ? new Map(categories.map((c) => [c.id, c.slug || c.id])) : null;
  const toItem = (r: StoredMenuRow): ResolvedMenuItem | null => {
    let href: string | null = null;
    let external = false;
    if (r.linkType === "CATEGORY" && r.target) {
      const segment = categorySlugById ? categorySlugById.get(r.target) : r.target;
      if (!segment) return null; // category deleted or inactive
      href = `/store/${slug}/category/${segment}`;
    }
    else if (r.linkType === "PAGE") href = storePath(slug, r.target || "/");
    else if (r.linkType === "CUSTOM" && r.target) {
      href = sanitizeCustomUrl(r.target);
      external = !!href && /^(https?:\/\/|mailto:|tel:)/i.test(href);
    }
    if (!href) return null;
    return { id: r.id, label: r.label, href, external, newTab: r.openInNewTab, children: [] };
  };

  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  const byParent = new Map<string, StoredMenuRow[]>();
  for (const r of sorted) {
    if (!r.parentId) continue;
    byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r]);
  }
  const out: ResolvedMenuItem[] = [];
  for (const r of sorted.filter((x) => !x.parentId)) {
    const item = toItem(r);
    if (!item) {
      // Dead parent: keep its still-valid dropdown links by promoting them to the top level.
      for (const c of byParent.get(r.id) ?? []) {
        const promoted = toItem(c);
        if (promoted) out.push(promoted);
      }
      continue;
    }
    item.children = (byParent.get(r.id) ?? []).map(toItem).filter((x): x is ResolvedMenuItem => !!x);
    out.push(item);
  }
  return out;
}

/**
 * A path relative to the store ("/about"), whichever way the page is reached: /store/<slug>/about (internal),
 * /<slug>/about (root URL) or /about (custom domain). Query, hash, case and trailing slash are ignored.
 */
export function storeRelativePath(input: string, storeSlug: string): string {
  let p = input.split("#")[0].split("?")[0].toLowerCase();
  for (const prefix of [`/store/${storeSlug.toLowerCase()}`, `/${storeSlug.toLowerCase()}`]) {
    if (p === prefix || p.startsWith(`${prefix}/`)) { p = p.slice(prefix.length); break; }
  }
  p = p.replace(/\/+$/g, "");
  return p === "" ? "/" : p.startsWith("/") ? p : `/${p}`;
}

/**
 * Is this menu link the page the visitor is on? Matches the exact page, or a parent section of it
 * (the "Shop" link stays lit on /shop/shoes). Home only matches the home page. External links, anchors, mailto: and tel: never match.
 * A top-level link with a dropdown is also lit when one of its children is.
 */
export function isMenuItemActive(item: { href: string; external: boolean; children?: { href: string; external: boolean }[] }, pathname: string, storeSlug: string): boolean {
  const here = storeRelativePath(pathname, storeSlug);
  const matches = (l: { href: string; external: boolean }) => {
    if (l.external || !l.href.startsWith("/")) return false;
    const target = storeRelativePath(l.href, storeSlug);
    return target === here || (target !== "/" && here.startsWith(`${target}/`));
  };
  return matches(item) || (item.children ?? []).some(matches);
}

/**
 * A custom menu whose links mostly point at pages this store no longer has (rooms or offers left over from a hotel
 * template, say) shrinks to one or two stray links, e.g. a header that says only "Blogs". When pages were dropped and at
 * most one top-level link survives, the menu is treated as stale and the template's default menu (home, shop, the
 * owner's categories, about, contact) is drawn instead. Nothing is deleted: the owner can still edit the menu.
 */
export function isStaleMenu(totalRows: number, keptRows: number, resolvedTopLevel: number): boolean {
  return totalRows > 0 && keptRows < totalRows && resolvedTopLevel <= 1;
}
