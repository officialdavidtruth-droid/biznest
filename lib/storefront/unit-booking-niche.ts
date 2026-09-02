// A single "unit booking" experience — the Rooms & Suites listing page plus
// the multi-step booking wizard — is shared by every business type that
// sells a bookable, per-night/per-day *unit* (a room, a short-let
// apartment, an event space, a rental vehicle…). Rather than hardcoding
// "Room" / "night" / hotel-flavoured copy into the two template
// components, every niche-specific string lives here, keyed by
// Store.businessType, so a new business type can adopt the exact same
// templates in one line by adding an entry to UNIT_BOOKING_NICHES.
//
// Per-store overrides (labels, add-ons, guarantees) come from
// Store.storefrontConfig.unitBooking — a JSON field, so store owners can
// customize copy without a schema change. See getUnitBookingNiche below.

export type BookingAddon = {
  id: string;
  label: string;
  description?: string;
  price: number;
};

export type Guarantee = {
  icon: "shield" | "calendar" | "badge" | "support";
  label: string;
  sublabel: string;
};

export type AmenityFacet = {
  /** Key looked up in Service.attributes / Product.attributes. */
  key: string;
  label: string;
};

export type UnitBookingNiche = {
  /** e.g. "Room" / "Unit" / "Space" / "Vehicle". */
  itemLabelSingular: string;
  /** e.g. "Rooms & Suites" / "Units" / "Spaces" / "Vehicles". */
  itemLabelPlural: string;
  /** e.g. "night" / "day" / "event" / "session". */
  rateUnit: string;
  sectionEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  /** Short pull-quote shown on the booking page hero, hotel-brochure style. */
  heroQuote: string;
  navLabel: string;
  reserveCta: string;
  amenityFacets: AmenityFacet[];
  guarantees: Guarantee[];
  addons: BookingAddon[];
};

const HOTEL_NICHE: UnitBookingNiche = {
  itemLabelSingular: "Room",
  itemLabelPlural: "Rooms & Suites",
  rateUnit: "night",
  sectionEyebrow: "Rooms & suites",
  heroTitle: "Book Your Stay",
  heroSubtitle: "A few details to complete your reservation.",
  heroQuote: "More Than a Stay, A Memory for Life.",
  navLabel: "Rooms",
  reserveCta: "Reserve",
  amenityFacets: [
    { key: "wifi", label: "Free WiFi" },
    { key: "breakfast", label: "Breakfast Included" },
    { key: "view", label: "City View" },
    { key: "pool", label: "Pool Access" },
    { key: "bathtub", label: "Bathtub" },
    { key: "workDesk", label: "Work Desk" },
    { key: "kitchenette", label: "Kitchenette" },
    { key: "smoking", label: "Smoking Allowed" },
  ],
  guarantees: [
    { icon: "shield", label: "Best Price Guarantee", sublabel: "No hidden charges" },
    { icon: "calendar", label: "Free Cancellation", sublabel: "Up to 24 hours before check-in" },
    { icon: "badge", label: "Instant Confirmation", sublabel: "Get your booking details immediately" },
    { icon: "support", label: "24/7 Support", sublabel: "We're always here to help" },
  ],
  addons: [
    { id: "breakfast", label: "Breakfast Package", description: "Daily breakfast buffet", price: 10000 },
    { id: "airport-pickup", label: "Airport Pickup", description: "Convenient and safe transfer", price: 25000 },
    { id: "romantic", label: "Romantic Package", description: "Flowers, wine & special setup", price: 20000 },
    { id: "extra-bed", label: "Extra Bed", description: "For additional guests", price: 15000 },
  ],
};

const SHORT_STAY_NICHE: UnitBookingNiche = {
  ...HOTEL_NICHE,
  itemLabelSingular: "Unit",
  itemLabelPlural: "Short-Stay Units",
  sectionEyebrow: "Available units",
  heroTitle: "Book Your Stay",
  heroSubtitle: "A few details to complete your reservation.",
  heroQuote: "Feels Like Home, Wherever You Land.",
  navLabel: "Units",
  addons: [
    { id: "cleaning", label: "Extra Cleaning", description: "Mid-stay refresh", price: 8000 },
    { id: "airport-pickup", label: "Airport Pickup", description: "Convenient and safe transfer", price: 25000 },
    { id: "late-checkout", label: "Late Checkout", description: "Check out up to 4pm", price: 6000 },
    { id: "extra-guest", label: "Extra Guest", description: "For additional occupants", price: 5000 },
  ],
};

const EVENT_VENUE_NICHE: UnitBookingNiche = {
  itemLabelSingular: "Space",
  itemLabelPlural: "Event Spaces",
  rateUnit: "event",
  sectionEyebrow: "Event spaces",
  heroTitle: "Book Your Event",
  heroSubtitle: "A few details to complete your reservation.",
  heroQuote: "Every Great Event Starts With The Right Space.",
  navLabel: "Spaces",
  reserveCta: "Reserve",
  amenityFacets: [
    { key: "wifi", label: "Free WiFi" },
    { key: "catering", label: "Catering Available" },
    { key: "parking", label: "On-Site Parking" },
    { key: "sound", label: "Sound System" },
    { key: "stage", label: "Stage / Platform" },
    { key: "airConditioning", label: "Air Conditioning" },
  ],
  guarantees: [
    { icon: "shield", label: "Best Price Guarantee", sublabel: "No hidden charges" },
    { icon: "calendar", label: "Flexible Rescheduling", sublabel: "Up to 7 days before your event" },
    { icon: "badge", label: "Instant Confirmation", sublabel: "Get your booking details immediately" },
    { icon: "support", label: "Event-Day Support", sublabel: "On-site help when you need it" },
  ],
  addons: [
    { id: "decor", label: "Decor Package", description: "Themed setup & styling", price: 40000 },
    { id: "catering", label: "Catering Add-on", description: "Per-guest catering service", price: 5000 },
    { id: "sound-tech", label: "Sound Technician", description: "On-site audio support", price: 30000 },
    { id: "extra-hours", label: "Extra Hours", description: "Extend your booking window", price: 15000 },
  ],
};

const VEHICLE_RENTAL_NICHE: UnitBookingNiche = {
  itemLabelSingular: "Vehicle",
  itemLabelPlural: "Vehicles",
  rateUnit: "day",
  sectionEyebrow: "Available vehicles",
  heroTitle: "Book Your Ride",
  heroSubtitle: "A few details to complete your reservation.",
  heroQuote: "Wherever You're Going, Get There Your Way.",
  navLabel: "Vehicles",
  reserveCta: "Reserve",
  amenityFacets: [
    { key: "ac", label: "Air Conditioning" },
    { key: "driver", label: "Driver Available" },
    { key: "gps", label: "GPS Navigation" },
    { key: "bluetooth", label: "Bluetooth Audio" },
  ],
  guarantees: [
    { icon: "shield", label: "Best Price Guarantee", sublabel: "No hidden charges" },
    { icon: "calendar", label: "Free Cancellation", sublabel: "Up to 24 hours before pickup" },
    { icon: "badge", label: "Instant Confirmation", sublabel: "Get your booking details immediately" },
    { icon: "support", label: "24/7 Roadside Support", sublabel: "We're always here to help" },
  ],
  addons: [
    { id: "driver", label: "Add a Driver", description: "Experienced, vetted driver", price: 12000 },
    { id: "insurance", label: "Extra Insurance", description: "Reduced excess on damage", price: 7000 },
    { id: "delivery", label: "Vehicle Delivery", description: "Delivered to your location", price: 10000 },
    { id: "child-seat", label: "Child Seat", description: "For younger passengers", price: 3000 },
  ],
};

/** Generic fallback for any bookable-unit business type without a bespoke entry above. */
const GENERIC_NICHE: UnitBookingNiche = {
  itemLabelSingular: "Unit",
  itemLabelPlural: "Available Units",
  rateUnit: "booking",
  sectionEyebrow: "Availability",
  heroTitle: "Complete Your Booking",
  heroSubtitle: "A few details to complete your reservation.",
  heroQuote: "Booking Made Simple.",
  navLabel: "Book",
  reserveCta: "Book Now",
  amenityFacets: [
    { key: "wifi", label: "Free WiFi" },
    { key: "parking", label: "Parking" },
  ],
  guarantees: [
    { icon: "shield", label: "Best Price Guarantee", sublabel: "No hidden charges" },
    { icon: "calendar", label: "Free Cancellation", sublabel: "Up to 24 hours before your booking" },
    { icon: "badge", label: "Instant Confirmation", sublabel: "Get your booking details immediately" },
    { icon: "support", label: "24/7 Support", sublabel: "We're always here to help" },
  ],
  addons: [],
};

/** Keyed by Store.businessType (see lib/capabilities.ts BUSINESS_TYPES). */
export const UNIT_BOOKING_NICHES: Record<string, UnitBookingNiche> = {
  "Hotel & Lodging": HOTEL_NICHE,
  "Real Estate": SHORT_STAY_NICHE,
  "Event Planning": EVENT_VENUE_NICHE,
  "Automotive": VEHICLE_RENTAL_NICHE,
};

/**
 * Business types that get the exact Rooms & Suites + Booking Wizard
 * templates: either a bespoke niche entry above, or (for any other
 * business type, present or future) a business type whose capability
 * list includes room/unit reservation management — see
 * lib/capabilities.ts BUSINESS_TYPES. This is what makes the templates
 * "just work" for a business type nobody has hand-configured yet.
 */
export function supportsUnitBooking(businessType: string | null | undefined, capabilities?: string[]): boolean {
  if (!businessType) return false;
  if (businessType in UNIT_BOOKING_NICHES) return true;
  if (!capabilities) return false;
  return capabilities.includes("room_management") || capabilities.includes("reservations");
}

function mergeNiche(base: UnitBookingNiche, overrides: Partial<UnitBookingNiche> | undefined): UnitBookingNiche {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    amenityFacets: overrides.amenityFacets ?? base.amenityFacets,
    guarantees: overrides.guarantees ?? base.guarantees,
    addons: overrides.addons ?? base.addons,
  };
}

/**
 * Resolves the full niche config for a store: a business-type default,
 * merged with any per-store overrides saved to
 * Store.storefrontConfig.unitBooking (e.g. a store owner renaming "Room"
 * to "Chalet", or swapping in their own add-on list).
 */
export function getUnitBookingNiche(
  businessType: string | null | undefined,
  storefrontConfig?: unknown
): UnitBookingNiche {
  const base = (businessType && UNIT_BOOKING_NICHES[businessType]) || GENERIC_NICHE;
  const config = storefrontConfig && typeof storefrontConfig === "object" ? (storefrontConfig as Record<string, unknown>) : null;
  const overrides = config?.unitBooking && typeof config.unitBooking === "object" ? (config.unitBooking as Partial<UnitBookingNiche>) : undefined;
  return mergeNiche(base, overrides);
}
