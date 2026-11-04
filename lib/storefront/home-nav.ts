/**
 * Header links the INNER pages (About, Contact, Services...) show, so they match the home page the store already has.
 * The home pages themselves are untouched: this file only mirrors what they show when the owner has not built a custom
 * menu. Pure data, no imports. Paths are relative to the store, "" is the home page.
 *
 * Keep in sync with: components/storefront/builder-renderer.tsx (defaultMenu) and signature-screenshot-home.tsx (Belora).
 */
export type NavLink = [label: string, path: string];

/** What the standard (builder) home page shows: Services for a service business, else Shop + Categories. */
export function builderHomeNav(isServiceBusiness: boolean): NavLink[] {
  return isServiceBusiness
    ? [["Home", ""], ["Services", "catalog"], ["About", "about"], ["Contact", "contact"]]
    : [["Home", ""], ["Shop", "catalog"], ["Categories", "categories"], ["About", "about"], ["Contact", "contact"]];
}
