import { isSignatureTemplate, getSignatureTheme } from "@/lib/template-themes";

export type AccountCopy = { orders: string; bookings: string; wishlist: string; account: string };

// Same wording the 13 Signature templates already used in the sidebar
// (components/storefront/signature-customer-shell.tsx) -- moved here so it
// can also drive the page titles/breadcrumbs those links land on, instead
// of those pages hardcoding "My orders" regardless of what the sidebar
// called the link that got you there.
const SIGNATURE_COPY: Record<string, AccountCopy> = {
  electra: { orders: "Orders", bookings: "Bookings", wishlist: "Wishlist", account: "My account" },
  atelier: { orders: "Purchases", bookings: "Appointments", wishlist: "Saved pieces", account: "My atelier" },
  kinetic: { orders: "Orders", bookings: "Bookings", wishlist: "Saved kicks", account: "My account" },
  bloom: { orders: "Orders", bookings: "Appointments", wishlist: "Saved beauty", account: "My account" },
  haven: { orders: "Orders", bookings: "Deliveries", wishlist: "Saved home", account: "My home" },
  harvest: { orders: "Orders", bookings: "Deliveries", wishlist: "Saved groceries", account: "My account" },
  maison: { orders: "Purchases", bookings: "My stays", wishlist: "Saved stays", account: "Guest account" },
  hotel: { orders: "Purchases", bookings: "Reservations", wishlist: "Saved stays", account: "Guest account" },
  ember: { orders: "Orders", bookings: "Reservations", wishlist: "Saved", account: "My account" },
  muse: { orders: "Orders", bookings: "Appointments", wishlist: "Saved services", account: "Client account" },
  frame: { orders: "Orders", bookings: "My sessions", wishlist: "Saved", account: "Client portal" },
  north: { orders: "Invoices", bookings: "Projects", wishlist: "Saved", account: "Client portal" },
  pure: { orders: "Orders", bookings: "My cleans", wishlist: "Saved", account: "My account" },
  forge: { orders: "Orders", bookings: "Projects", wishlist: "Saved", account: "Project portal" },
};

// For stores on a non-Signature (legacy) template, there's no per-template
// mode to key off of -- so terminology is instead derived from the
// business category, using the same words a Signature store of that kind
// of business would get. Falls through to a sensible generic default.
const CATEGORY_COPY: Record<string, AccountCopy> = {
  "Hotel & Lodging": SIGNATURE_COPY.hotel,
  "Restaurant": SIGNATURE_COPY.ember,
  "Beauty": SIGNATURE_COPY.bloom,
  "Salon": SIGNATURE_COPY.muse,
  "Photography": SIGNATURE_COPY.frame,
  "Professional Services": SIGNATURE_COPY.north,
  "Software Development": SIGNATURE_COPY.north,
  "Agency": SIGNATURE_COPY.north,
  "Construction": SIGNATURE_COPY.forge,
  "Cleaning": SIGNATURE_COPY.pure,
  "Fashion": SIGNATURE_COPY.atelier,
  "Home & Furniture": SIGNATURE_COPY.haven,
  "Food & Groceries": SIGNATURE_COPY.harvest,
};

const DEFAULT_COPY: AccountCopy = { orders: "Orders", bookings: "Bookings", wishlist: "Wishlist", account: "My account" };

/**
 * The single source of truth for how a store's customer account area
 * refers to orders/bookings/wishlist/the account itself. Used by the
 * account sidebar (which link is shown) AND the pages those links land on
 * (page titles, breadcrumbs) so a customer never clicks "Purchases" and
 * lands on a page titled "My orders".
 */
export function getAccountCopy(templateName: string | null | undefined, businessCategory?: string | null): AccountCopy {
  if (isSignatureTemplate(templateName)) {
    const mode = getSignatureTheme(templateName).signatureMode;
    return SIGNATURE_COPY[mode] ?? DEFAULT_COPY;
  }
  if (businessCategory && CATEGORY_COPY[businessCategory]) return CATEGORY_COPY[businessCategory];
  return DEFAULT_COPY;
}
