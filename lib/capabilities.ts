/**
 * The BizNest capability system.
 *
 *   Business Type → Capabilities → Sections → Features
 *
 * This is the single source of truth for "what does a business of this
 * type get." Before this file, that question had no one answer — it was
 * scattered across lib/constants/category-dashboard.ts (dashboard quick
 * actions), the marketing category list on app/page.tsx (hand-maintained
 * separately, and already out of sync — see below), Service.isBookable
 * (booking on/off, but only per-listing, not per-business-type), and
 * Product.attributes (a free-form JSON bag with no schema telling you
 * which fields a given business type actually uses).
 *
 * That drift was real, not hypothetical: app/page.tsx's marketing page
 * advertises "Real Estate", "Photography", "Software Development",
 * "Event Planning", and "Logistics" as categories a seller can pick — but
 * category-dashboard.ts had no config for any of them, so every one of
 * those sellers silently got the generic "Other" dashboard. Nobody
 * decided that; it happened because there were two lists instead of one.
 *
 * How to extend this system when a new business type comes along:
 *   1. Add it to BUSINESS_TYPES below with its capability list.
 *   2. If a capability doesn't exist yet, add it to the Capability union
 *      and, if it needs its own storefront section, add it to
 *      CAPABILITY_SECTIONS (and to the Section type in template-themes.ts
 *      if it's a new kind of section).
 *   3. That's it — the dashboard config, the marketing category list, and
 *      (as templates adopt it) which storefront sections render are all
 *      derived from this one entry. Nothing else to update by hand.
 */

import type { LucideIcon } from "lucide-react";
import type { Section } from "@/lib/template-themes";
import {
  Shirt, Cpu, Utensils, Sparkles, Sofa, HeartPulse, Briefcase, Car, Tractor,
  Store as StoreIcon, Truck, CalendarClock, Wrench, Building2, Camera, Hotel,
  Code, PartyPopper, Package,
} from "lucide-react";

/**
 * Atomic units of functionality. Deliberately granular and reusable across
 * business types — "delivery" means the same thing whether you're a
 * restaurant or a furniture store, so it's defined once and composed, not
 * redefined per type.
 */
export type Capability =
  | "products" // sellable physical/digital goods (catalog)
  | "services" // sellable services (distinct from bookable appointments)
  | "bookings" // appointment/reservation scheduling (Booking model)
  | "availability_calendar" // visible calendar of open slots/dates
  | "delivery"
  | "pickup"
  | "opening_hours"
  | "gallery"
  | "amenities" // e.g. hotel room amenities, venue features
  | "menu_categories" // grouped menu/catalog browsing (restaurant-style)
  | "map_location"
  | "property_details" // bedrooms/bathrooms/area/type structured fields
  | "packages" // bundled service tiers (e.g. photography packages)
  | "portfolio" // showcase of past work, distinct from a sellable gallery
  | "reviews"
  | "coupons"
  | "inventory";

export const CAPABILITY_LABELS: Record<Capability, string> = {
  products: "Product catalog",
  services: "Service catalog",
  bookings: "Booking & scheduling",
  availability_calendar: "Availability calendar",
  delivery: "Delivery",
  pickup: "Pickup",
  opening_hours: "Opening hours",
  gallery: "Gallery",
  amenities: "Amenities",
  menu_categories: "Menu categories",
  map_location: "Map & location",
  property_details: "Property details",
  packages: "Packages",
  portfolio: "Portfolio",
  reviews: "Reviews",
  coupons: "Coupons & promotions",
  inventory: "Inventory tracking",
};

/**
 * Which storefront section a capability implies, when it implies one.
 * A business type's full section list (see resolveSections below) is the
 * union of its capabilities' sections, in a fixed display order, plus the
 * evergreen sections (hero/about/contact/testimonials) every type gets.
 */
const CAPABILITY_SECTIONS: Partial<Record<Capability, Section>> = {
  products: "catalog",
  services: "catalog",
  gallery: "gallery",
  portfolio: "gallery",
  amenities: "amenities",
  availability_calendar: "availability",
  map_location: "map",
  packages: "packages",
  menu_categories: "categories",
};

const EVERGREEN_SECTIONS: Section[] = ["hero", "about", "testimonials", "contact"];
const SECTION_ORDER: Section[] = ["hero", "gallery", "categories", "catalog", "packages", "amenities", "availability", "map", "about", "stats", "features", "testimonials", "newsletter", "deal", "contact"];

export type QuickAction = { label: string; href: string };
export type NavItem = { label: string; href: string; icon: LucideIcon };

export type BusinessTypeConfig = {
  icon: LucideIcon;
  tagline: string;
  capabilities: Capability[];
  quickActions: QuickAction[];
  /** Extra sidebar nav item(s) this business type gets beyond the default set. */
  extraNavItems?: NavItem[];
};

/**
 * The one map every business type is defined in. Keyed by the same string
 * stored on Business.category (see lib/validations/business.ts) — free-form
 * today, but every value actually offered at onboarding must have an entry
 * here (enforced by ALL_BUSINESS_TYPE_NAMES / the marketing page importing
 * from this file instead of maintaining its own list — see app/page.tsx).
 */
export const BUSINESS_TYPES: Record<string, BusinessTypeConfig> = {
  "Fashion": {
    icon: Shirt,
    tagline: "Fashion storefront",
    capabilities: ["products", "reviews", "coupons", "inventory"],
    quickActions: [
      { label: "Add a product", href: "/products/new" },
      { label: "Set up size & color variants", href: "/products" },
      { label: "Run a seasonal coupon", href: "/coupons" },
    ],
  },
  "Electronics": {
    icon: Cpu,
    tagline: "Electronics storefront",
    capabilities: ["products", "reviews", "inventory"],
    quickActions: [
      { label: "Add a product", href: "/products/new" },
      { label: "Track stock levels", href: "/inventory" },
      { label: "Set warranty terms", href: "/settings" },
    ],
  },
  "Food & Groceries": {
    icon: Utensils,
    tagline: "Food & groceries storefront",
    capabilities: ["products", "delivery", "inventory"],
    quickActions: [
      { label: "Add a product", href: "/products/new" },
      { label: "Set delivery zones", href: "/delivery" },
      { label: "Check today's orders", href: "/orders" },
    ],
    extraNavItems: [{ label: "Delivery zones", href: "/delivery", icon: Truck }],
  },
  "Restaurant": {
    icon: Utensils,
    tagline: "Restaurant storefront",
    capabilities: ["products", "menu_categories", "delivery", "pickup", "opening_hours", "reviews"],
    quickActions: [
      { label: "Add a menu item", href: "/products/new" },
      { label: "Set delivery zones", href: "/delivery" },
      { label: "Set opening hours", href: "/settings" },
    ],
    extraNavItems: [{ label: "Delivery zones", href: "/delivery", icon: Truck }],
  },
  "Hotel & Lodging": {
    icon: Hotel,
    tagline: "Hotel storefront",
    capabilities: ["services", "bookings", "availability_calendar", "gallery", "amenities", "reviews"],
    quickActions: [
      { label: "Add a room", href: "/services/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Update amenities", href: "/settings" },
    ],
    extraNavItems: [{ label: "Bookings", href: "/orders", icon: CalendarClock }],
  },
  "Beauty": {
    icon: Sparkles,
    tagline: "Beauty storefront",
    capabilities: ["services", "bookings", "reviews"],
    quickActions: [
      { label: "Add a service", href: "/services/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Collect reviews", href: "/reviews" },
    ],
    extraNavItems: [{ label: "Bookings", href: "/orders", icon: CalendarClock }],
  },
  "Home & Furniture": {
    icon: Sofa,
    tagline: "Home & furniture storefront",
    capabilities: ["products", "delivery", "inventory"],
    quickActions: [
      { label: "Add a product", href: "/products/new" },
      { label: "Set delivery zones", href: "/delivery" },
      { label: "Track stock levels", href: "/inventory" },
    ],
  },
  "Health": {
    icon: HeartPulse,
    tagline: "Health storefront",
    capabilities: ["services", "bookings", "reviews"],
    quickActions: [
      { label: "Add a service", href: "/services/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Update your credentials", href: "/verification" },
    ],
    extraNavItems: [{ label: "Bookings", href: "/orders", icon: CalendarClock }],
  },
  "Health & Fitness": {
    icon: HeartPulse,
    tagline: "Health & fitness storefront",
    capabilities: ["services", "bookings", "availability_calendar", "reviews"],
    quickActions: [
      { label: "Add a class or service", href: "/services/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Update your credentials", href: "/verification" },
    ],
    extraNavItems: [{ label: "Bookings", href: "/orders", icon: CalendarClock }],
  },
  "Professional Services": {
    icon: Briefcase,
    tagline: "Professional services storefront",
    capabilities: ["services", "bookings"],
    quickActions: [
      { label: "Add a service", href: "/services/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Message a customer", href: "/messages" },
    ],
    extraNavItems: [{ label: "Bookings", href: "/orders", icon: CalendarClock }],
  },
  "Automotive": {
    icon: Car,
    tagline: "Automotive storefront",
    capabilities: ["products", "services", "bookings", "inventory"],
    quickActions: [
      { label: "Add a product or service", href: "/products/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Track parts inventory", href: "/inventory" },
    ],
    extraNavItems: [{ label: "Bookings", href: "/orders", icon: Wrench }],
  },
  "Agriculture": {
    icon: Tractor,
    tagline: "Agriculture storefront",
    capabilities: ["products", "delivery", "inventory"],
    quickActions: [
      { label: "Add produce", href: "/products/new" },
      { label: "Set delivery zones", href: "/delivery" },
      { label: "Track stock levels", href: "/inventory" },
    ],
  },
  "Real Estate": {
    icon: Building2,
    tagline: "Real estate storefront",
    capabilities: ["products", "property_details", "map_location", "gallery"],
    quickActions: [
      { label: "Add a listing", href: "/products/new" },
      { label: "Set bedrooms, bathrooms & type", href: "/products" },
      { label: "Set the listing's location", href: "/products" },
    ],
  },
  "Photography": {
    icon: Camera,
    tagline: "Photography storefront",
    capabilities: ["portfolio", "gallery", "packages", "bookings"],
    quickActions: [
      { label: "Upload to your portfolio", href: "/products/new" },
      { label: "Set up a package", href: "/products/new" },
      { label: "Manage bookings", href: "/orders" },
    ],
    extraNavItems: [{ label: "Bookings", href: "/orders", icon: CalendarClock }],
  },
  "Software Development": {
    icon: Code,
    tagline: "Software services storefront",
    capabilities: ["services", "packages", "bookings"],
    quickActions: [
      { label: "Add a service or package", href: "/services/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Message a client", href: "/messages" },
    ],
    extraNavItems: [{ label: "Bookings", href: "/orders", icon: CalendarClock }],
  },
  "Event Planning": {
    icon: PartyPopper,
    tagline: "Event planning storefront",
    capabilities: ["services", "packages", "bookings", "gallery"],
    quickActions: [
      { label: "Add a package", href: "/services/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Upload past event photos", href: "/products/new" },
    ],
    extraNavItems: [{ label: "Bookings", href: "/orders", icon: CalendarClock }],
  },
  "Logistics": {
    icon: Package,
    tagline: "Logistics storefront",
    capabilities: ["services", "delivery", "bookings"],
    quickActions: [
      { label: "Add a service", href: "/services/new" },
      { label: "Set delivery zones", href: "/delivery" },
      { label: "Manage bookings", href: "/orders" },
    ],
    extraNavItems: [{ label: "Delivery zones", href: "/delivery", icon: Truck }],
  },
  "Other": {
    icon: StoreIcon,
    tagline: "Storefront",
    capabilities: ["products", "services"],
    quickActions: [
      { label: "Add a listing", href: "/products/new" },
      { label: "Check today's orders", href: "/orders" },
      { label: "Customize your website", href: "/customize" },
    ],
  },
};

export const DEFAULT_BUSINESS_TYPE = BUSINESS_TYPES["Other"];

/** Every business type name a seller can pick at onboarding — the single
 * list app/page.tsx's marketing copy should render from, so it can never
 * drift out of sync with what the dashboard actually supports again. */
export const ALL_BUSINESS_TYPE_NAMES = Object.keys(BUSINESS_TYPES).filter((n) => n !== "Other");

export function getBusinessTypeConfig(category: string | null | undefined): BusinessTypeConfig {
  if (!category) return DEFAULT_BUSINESS_TYPE;
  return BUSINESS_TYPES[category] ?? DEFAULT_BUSINESS_TYPE;
}

export function hasCapability(category: string | null | undefined, capability: Capability): boolean {
  return getBusinessTypeConfig(category).capabilities.includes(capability);
}

/**
 * Resolves a business type down to the ordered list of storefront sections
 * it should show — evergreen sections plus whatever its capabilities imply,
 * deduplicated and placed in a fixed display order (see SECTION_ORDER).
 * A template can intersect this with the sections it's actually built to
 * render (see lib/template-themes.ts sections field) rather than assuming
 * every template supports every section.
 */
export function resolveSections(category: string | null | undefined): Section[] {
  const config = getBusinessTypeConfig(category);
  const fromCapabilities = config.capabilities
    .map((cap) => CAPABILITY_SECTIONS[cap])
    .filter((s): s is Section => Boolean(s));
  const all = new Set<Section>([...EVERGREEN_SECTIONS, ...fromCapabilities]);
  return SECTION_ORDER.filter((s) => all.has(s));
}
