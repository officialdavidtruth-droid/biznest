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

export type BookingRules = {
  /**
   * Heading + bullets for the start of the booking, e.g. "Check In" / "Pickup".
   * A bullet may contain the token {start} (and end-rule bullets {end}); it is
   * replaced by the property's real time, and the bullet is dropped if no
   * time is known -- see resolveBookingRules.
   */
  start: { title: string; items: string[] };
  /** Heading + bullets for the end of the booking, e.g. "Check Out" / "Return". */
  end: { title: string; items: string[] };
};

/** Standard start/end-of-booking times, display-formatted (e.g. "2:00 PM"). */
export type StayTimes = { start: string; end: string };

export type UnitBookingNiche = {
  /** e.g. "Room" / "Unit" / "Space" / "Vehicle". */
  itemLabelSingular: string;
  /** e.g. "Rooms & Suites" / "Units" / "Spaces" / "Vehicles". */
  itemLabelPlural: string;
  /** e.g. "night" / "day" / "event" / "session". */
  rateUnit: string;
  /**
   * What a counted span of the booking is called in the widget ("2 nights",
   * "3 days"). Defaults to rateUnit; differs where the price unit isn't a
   * time span (a restaurant "table" is priced per table, counted in days).
   */
  periodUnit?: string;
  /** Label above the start-date picker, e.g. "Check-in" / "Pickup date". */
  startDateLabel: string;
  /** Default start/end times substituted into bookingRules tokens. */
  stayTimes?: StayTimes;
  sectionEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  /** Short pull-quote shown on the booking page hero, hotel-brochure style. */
  heroQuote: string;
  navLabel: string;
  reserveCta: string;
  /**
   * Start/end rules shown on the single item page. `null` hides the block
   * entirely (nothing is better than hotel policy on a non-hotel niche).
   */
  bookingRules: BookingRules | null;
  amenityFacets: AmenityFacet[];
  guarantees: Guarantee[];
  addons: BookingAddon[];
};

const HOTEL_NICHE: UnitBookingNiche = {
  itemLabelSingular: "Room",
  itemLabelPlural: "Rooms & Suites",
  rateUnit: "night",
  startDateLabel: "Check-in",
  stayTimes: { start: "2:00 PM", end: "12:00 PM" },
  sectionEyebrow: "Rooms & suites",
  heroTitle: "Book Your Stay",
  heroSubtitle: "A few details to complete your reservation.",
  heroQuote: "More Than a Stay, A Memory for Life.",
  navLabel: "Rooms",
  reserveCta: "Reserve",
  bookingRules: {
    start: { title: "Check In", items: ["Check-in from {start}", "Valid photo ID required", "Early arrival subject to availability"] },
    end: { title: "Check Out", items: ["Check-out by {end}", "Late checkout subject to availability", "Notify reception for assistance"] },
  },
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
  startDateLabel: "Event date",
  sectionEyebrow: "Event spaces",
  heroTitle: "Book Your Event",
  heroSubtitle: "A few details to complete your reservation.",
  heroQuote: "Every Great Event Starts With The Right Space.",
  navLabel: "Spaces",
  reserveCta: "Reserve",
  bookingRules: {
    start: { title: "Arrival & Setup", items: ["Access from your agreed setup time", "Valid ID required on arrival", "Vendor access subject to venue approval"] },
    end: { title: "Event End", items: ["Wrap up by your agreed end time", "Extra hours subject to availability", "Contact the venue team for assistance"] },
  },
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
  startDateLabel: "Pickup date",
  sectionEyebrow: "Available vehicles",
  heroTitle: "Book Your Ride",
  heroSubtitle: "A few details to complete your reservation.",
  heroQuote: "Wherever You're Going, Get There Your Way.",
  navLabel: "Vehicles",
  reserveCta: "Reserve",
  bookingRules: {
    start: { title: "Pickup", items: ["Valid driver's licence and ID required", "Vehicle inspected together at handover", "Early pickup subject to availability"] },
    end: { title: "Return", items: ["Return by the agreed time", "Late returns may incur extra charges", "Contact us if your plans change"] },
  },
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

const RESTAURANT_NICHE: UnitBookingNiche = {
  itemLabelSingular: "Table",
  itemLabelPlural: "Tables",
  rateUnit: "table",
  periodUnit: "day",
  startDateLabel: "Reservation date",
  sectionEyebrow: "Reserve a table",
  heroTitle: "Reserve Your Table",
  heroSubtitle: "A few details to complete your reservation.",
  heroQuote: "Good Food Is Better Shared.",
  navLabel: "Tables",
  reserveCta: "Reserve a Table",
  bookingRules: {
    start: { title: "Arrival", items: ["Please arrive at your reserved time", "Tell us about any dietary needs in advance", "Larger parties may need to confirm with the restaurant"] },
    end: { title: "Changes", items: ["Contact us as early as possible to change or cancel", "Special setups are subject to availability"] },
  },
  amenityFacets: [
    { key: "indoor", label: "Indoor Seating" },
    { key: "outdoor", label: "Outdoor Seating" },
    { key: "private", label: "Private Dining" },
    { key: "airConditioning", label: "Air Conditioning" },
    { key: "wifi", label: "Free WiFi" },
    { key: "parking", label: "Parking" },
  ],
  guarantees: [
    { icon: "shield", label: "Transparent Pricing", sublabel: "No hidden charges" },
    { icon: "calendar", label: "Easy Changes", sublabel: "Reschedule or cancel with notice" },
    { icon: "badge", label: "Instant Confirmation", sublabel: "Get your reservation details immediately" },
    { icon: "support", label: "Host Support", sublabel: "We're here to help with special requests" },
  ],
  addons: [],
};

/** Generic fallback for any bookable-unit business type without a bespoke entry above. */
const GENERIC_NICHE: UnitBookingNiche = {
  itemLabelSingular: "Unit",
  itemLabelPlural: "Available Units",
  rateUnit: "booking",
  startDateLabel: "Start date",
  sectionEyebrow: "Availability",
  heroTitle: "Complete Your Booking",
  heroSubtitle: "A few details to complete your reservation.",
  heroQuote: "Booking Made Simple.",
  navLabel: "Book",
  reserveCta: "Book Now",
  bookingRules: null,
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
  "Restaurant": RESTAURANT_NICHE,
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
    stayTimes: base.stayTimes || overrides.stayTimes ? { ...base.stayTimes, ...overrides.stayTimes } as StayTimes : undefined,
  };
}

/** "14:00" / "14:00:00" -> "2:00 PM". Already-formatted text ("2pm", "2:00 PM") passes through. */
export function formatStayTime(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!m) return raw;
  const h = Number(m[1]);
  const min = m[2];
  if (h > 23 || Number(min) > 59) return raw;
  return `${h % 12 === 0 ? 12 : h % 12}:${min} ${h >= 12 ? "PM" : "AM"}`;
}

/**
 * Fills the {start} / {end} tokens in a niche's booking rules with the real
 * times: explicit property times first (e.g. the hotel's configured
 * check-in/out), then the niche's own defaults. A bullet whose token has no
 * time to fill it is dropped rather than shown with a made-up time.
 */
export function resolveBookingRules(
  niche: UnitBookingNiche,
  times?: { checkIn?: string | null; checkOut?: string | null } | null
): BookingRules | null {
  if (!niche.bookingRules) return null;
  const start = formatStayTime(times?.checkIn) ?? niche.stayTimes?.start;
  const end = formatStayTime(times?.checkOut) ?? niche.stayTimes?.end;
  const fill = (items: string[]) =>
    items
      .filter((item) => !(item.includes("{start}") && !start) && !(item.includes("{end}") && !end))
      .map((item) => item.replace("{start}", start ?? "").replace("{end}", end ?? ""));
  const { start: s0, end: e0 } = niche.bookingRules;
  return { start: { title: s0.title, items: fill(s0.items) }, end: { title: e0.title, items: fill(e0.items) } };
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
