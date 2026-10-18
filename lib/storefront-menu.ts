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

export function resolveMenuRows(rows: StoredMenuRow[], slug: string): ResolvedMenuItem[] {
  const toItem = (r: StoredMenuRow): ResolvedMenuItem | null => {
    let href: string | null = null;
    let external = false;
    if (r.linkType === "CATEGORY" && r.target) href = `/store/${slug}/category/${r.target}`;
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
    if (!item) continue;
    item.children = (byParent.get(r.id) ?? []).map(toItem).filter((x): x is ResolvedMenuItem => !!x);
    out.push(item);
  }
  return out;
}
