/**
 * "First sale" onboarding checklist -- pure logic, no Prisma / Next imports, so it
 * is unit-testable and safe to import from client components.
 *
 * The goal is to get a new vendor from "store created" to "first sale" fast:
 *   1. add a logo
 *   2. add 3 real listings (products / services / rooms)
 *   3. make the website look like theirs (Customize)
 *   4. set up the navigation menu
 *   5. connect a payout account
 *   6. share the store link
 *
 * Data comes from the database (see lib/onboarding-checklist-data.ts); the only
 * state this feature stores itself lives under Store.onboardingProfile.checklist
 * (JSON, no migration): when the link was shared and when the card was dismissed.
 */
import { SAMPLE_LISTINGS } from "@/lib/sample-listings";
import type { CanonicalBusinessType } from "@/lib/business-identity";

export const LISTINGS_TARGET = 3;

export type ChecklistStepId = "logo" | "listings" | "look" | "menu" | "payout" | "share";

export type ChecklistStep = {
  id: ChecklistStepId;
  title: string;
  description: string;
  done: boolean;
  /** Path under /<slug>/admin. Null for steps completed inline (share). */
  href: string | null;
  cta: string;
  /** PMS / F&B shells need a full page load, not a soft <Link> navigation. */
  hardLink?: boolean;
};

export type ChecklistState = {
  steps: ChecklistStep[];
  doneCount: number;
  total: number;
  complete: boolean;
  listingNoun: string;
};

/* ------------------------------------------------------------------ */
/* Placeholder (auto-seeded) listings                                  */
/* ------------------------------------------------------------------ */

// createStore seeds 2 sample listings per niche (lib/sample-listings.ts) as ordinary
// published rows with no marker. They must not count toward "add 3 listings", or a
// brand-new store would start at 2/3 without the vendor doing anything. A listing
// counts as a placeholder only while it still carries one of those exact names;
// renaming it (or adding any new listing) makes it real.
const PLACEHOLDER_NAMES: ReadonlySet<string> = new Set(
  Object.values(SAMPLE_LISTINGS)
    .flat()
    .map((s) => normalizeName(s.name))
);

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function isPlaceholderListingName(name: string): boolean {
  return PLACEHOLDER_NAMES.has(normalizeName(name));
}

export function countRealListings(names: string[]): number {
  return names.filter((n) => !isPlaceholderListingName(n)).length;
}

/* ------------------------------------------------------------------ */
/* Persisted flags (Store.onboardingProfile.checklist)                  */
/* ------------------------------------------------------------------ */

export type ChecklistMeta = { linkSharedAt: string | null; dismissedAt: string | null };

function asIso(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

export function readChecklistMeta(onboardingProfile: unknown): ChecklistMeta {
  if (!onboardingProfile || typeof onboardingProfile !== "object" || Array.isArray(onboardingProfile)) {
    return { linkSharedAt: null, dismissedAt: null };
  }
  const raw = (onboardingProfile as Record<string, unknown>).checklist;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { linkSharedAt: null, dismissedAt: null };
  const c = raw as Record<string, unknown>;
  return { linkSharedAt: asIso(c.linkSharedAt), dismissedAt: asIso(c.dismissedAt) };
}

/**
 * Returns a copy of the profile with `patch` merged into its `checklist` key. Every
 * other key (e.g. `subcategory`, written by the setup wizard) is preserved as-is.
 */
export function mergeChecklistMeta(
  onboardingProfile: unknown,
  patch: Partial<ChecklistMeta>
): Record<string, unknown> {
  const base =
    onboardingProfile && typeof onboardingProfile === "object" && !Array.isArray(onboardingProfile)
      ? { ...(onboardingProfile as Record<string, unknown>) }
      : {};
  const current = readChecklistMeta(onboardingProfile);
  return { ...base, checklist: { ...current, ...patch } };
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

export type ChecklistInput = {
  logoUrl?: string | null;
  /** Published listings that are not auto-seeded placeholders (+ rooms for hotels). */
  realListingCount: number;
  hasBankPayout: boolean;
  /** Store only has a legacy subaccount and must re-enter bank details. */
  needsPayoutReconnect: boolean;
  linkShared: boolean;
  /** The owner changed colours, fonts or sections in Customize (or the AI builder did it for them). */
  lookCustomized?: boolean;
  /** The owner saved a header or footer menu. */
  menuSaved?: boolean;
  category: CanonicalBusinessType;
  sellsProducts: boolean;
  offersServices: boolean;
};

export function listingNoun(category: CanonicalBusinessType, caps: { sellsProducts: boolean; offersServices: boolean }): string {
  if (category === "Hotel & Lodging") return "rooms";
  if (category === "Restaurant") return "menu items";
  if (caps.offersServices && !caps.sellsProducts) return "services";
  return "products";
}

export function buildChecklist(input: ChecklistInput): ChecklistState {
  const noun = listingNoun(input.category, input);
  const isHotel = input.category === "Hotel & Lodging";
  const servicesOnly = input.offersServices && !input.sellsProducts;
  const shown = Math.min(input.realListingCount, LISTINGS_TARGET);

  const steps: ChecklistStep[] = [
    {
      id: "logo",
      title: "Add your logo",
      description: "A recognisable logo makes customers more comfortable paying you.",
      done: Boolean(input.logoUrl),
      href: "/settings",
      cta: "Upload logo",
    },
    {
      id: "listings",
      title: `Add ${LISTINGS_TARGET} ${noun}`,
      description: `${shown} of ${LISTINGS_TARGET} added. Your sample listings don't count; add your own with real prices and photos.`,
      done: input.realListingCount >= LISTINGS_TARGET,
      href: isHotel ? "/pms" : servicesOnly ? "/services/new" : "/products/new",
      cta: `Add ${isHotel ? "rooms" : noun}`,
      hardLink: isHotel,
    },
    {
      id: "look",
      title: "Make the website yours",
      description: "Choose your colours and fonts, and reorder the sections on your home page, with a live preview.",
      done: Boolean(input.lookCustomized),
      href: "/customize",
      cta: "Customize website",
    },
    {
      id: "menu",
      title: "Set up your menu",
      description: "Choose the links at the top and bottom of your website. A starting menu is already filled in for you.",
      done: Boolean(input.menuSaved),
      href: "/menus",
      cta: "Edit menus",
    },
    {
      id: "payout",
      title: input.needsPayoutReconnect ? "Reconnect your payout account" : "Set up how customers pay you",
      description: input.needsPayoutReconnect
        ? "Your payout setup needs a quick update. Re-enter your bank details."
        : "Add your bank account details. Customers pay you by bank transfer and you confirm it. Without this, checkout is blocked.",
      done: input.hasBankPayout,
      href: "/payments",
      cta: input.needsPayoutReconnect ? "Reconnect" : "Add bank details",
    },
    {
      id: "share",
      title: "Share your store link",
      description: "Send it to customers on WhatsApp, Instagram or your status. Your first sale starts here.",
      done: input.linkShared,
      href: null,
      cta: "Share",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, complete: doneCount === steps.length, listingNoun: noun };
}

/* ------------------------------------------------------------------ */
/* Business-type starter ideas                                         */
/* ------------------------------------------------------------------ */

export type StarterIdea = {
  id: string;
  kind: "product" | "service";
  name: string;
  description: string;
  /** NGN. A placeholder the vendor is expected to change. */
  price: number;
  bookingMode?: "none" | "appointment";
  durationMins?: number;
};

type IdeaSeed = Omit<StarterIdea, "id">;

function p(name: string, description: string, price: number): IdeaSeed {
  return { kind: "product", name, description, price };
}
function s(name: string, description: string, price: number, durationMins?: number): IdeaSeed {
  return durationMins
    ? { kind: "service", name, description, price, bookingMode: "appointment", durationMins }
    : { kind: "service", name, description, price, bookingMode: "none" };
}

const IDEAS: Partial<Record<CanonicalBusinessType, IdeaSeed[]>> = {
  Restaurant: [
    p("Jollof Rice & Chicken", "Party-style jollof rice served with a quarter of grilled chicken.", 3500),
    p("Fried Rice & Turkey", "Fried rice with mixed vegetables, served with seasoned turkey.", 4000),
    p("Goat Meat Pepper Soup", "Hot, spicy pepper soup made with fresh goat meat.", 3000),
    p("Chilled Zobo (500ml)", "Home-made hibiscus drink, served cold.", 800),
  ],
  Fashion: [
    p("Ankara Skirt & Top Set", "Two-piece Ankara set, tailored to your measurements.", 18000),
    p("Men's Senator Outfit", "Classic senator wear, made to order in your choice of fabric.", 25000),
    p("Lace Gown (Made to Order)", "Elegant lace gown for weddings and special occasions.", 35000),
    p("Ankara Head Wrap", "Ready-to-tie Ankara head wrap in assorted prints.", 3500),
  ],
  Beauty: [
    p("Shea Butter Body Cream (250g)", "Rich, moisturising body cream made with pure shea butter.", 4500),
    p("Matte Lipstick", "Long-wear matte lipstick available in several shades.", 3500),
    p("Hair Growth Oil (100ml)", "Nourishing oil blend for healthier, fuller hair.", 5000),
    p("Gentle Face Cleanser", "Daily face wash suitable for most skin types.", 6000),
  ],
  Salon: [
    s("Wash & Blow-dry", "Shampoo, conditioning treatment and a smooth blow-dry finish.", 5000, 60),
    s("Box Braids", "Neat box braids, hair included. Includes wash and prep.", 25000, 240),
    s("Gel Manicure", "Shaping, cuticle care and long-lasting gel polish.", 8000, 60),
    s("Haircut & Styling", "Cut and style tailored to your face shape.", 3000, 45),
  ],
  Electronics: [
    p("Power Bank (20,000mAh)", "High-capacity power bank with dual USB output.", 18000),
    p("Phone Case & Screen Guard Bundle", "Protective case and tempered glass screen guard.", 5000),
    p("Portable Bluetooth Speaker", "Wireless speaker with clear sound and long battery life.", 15000),
    p("USB-C Charging Cable (2m)", "Durable fast-charging USB-C cable.", 2500),
  ],
  "Food & Groceries": [
    p("Bag of Rice (10kg)", "Clean, stone-free long-grain rice.", 17000),
    p("Vegetable Oil (5L)", "Pure vegetable cooking oil.", 12000),
    p("Instant Noodles (Carton)", "A full carton of instant noodles for the family.", 8500),
    p("Fresh Tomato & Pepper Basket", "A basket of fresh tomatoes and peppers, delivered fresh.", 6000),
  ],
  "Home & Furniture": [
    p("Accent Chair", "Comfortable accent chair with a durable upholstered finish.", 55000),
    p("Throw Pillow Set (2 pieces)", "Soft decorative pillows to refresh any living room.", 7500),
    p("Decorative Wall Mirror", "Round framed mirror for your living room or hallway.", 28000),
  ],
  Photography: [
    s("Passport Photographs", "Quick, clean passport photos printed and ready to take away.", 3000),
    s("Birthday Photo Shoot", "A 2-hour birthday shoot with edited photos delivered online.", 45000, 120),
    s("Wedding Photography (Full Day)", "Full-day coverage with an edited gallery of your best moments.", 250000, 480),
  ],
  Cleaning: [
    s("Home Cleaning (2-Bedroom)", "A thorough clean of a two-bedroom home, supplies included.", 25000, 180),
    s("Office Cleaning (Per Visit)", "Professional cleaning for small and medium offices.", 40000, 240),
    s("Deep Clean Add-on", "Extra attention to kitchens, bathrooms and hard-to-reach spots.", 15000),
  ],
  "Event Planning": [
    s("Birthday Party Planning", "Planning and coordination so your party runs smoothly.", 150000),
    s("Wedding Day Coordination", "A coordinator on hand from setup to the last dance.", 200000),
    s("Event Decor Package", "Themed decor, setup and takedown for your venue.", 120000),
  ],
  "Professional Services": [
    s("One-hour Consultation", "A focused one-on-one session to review your needs and next steps.", 15000, 60),
    s("Project Discovery Session", "Scope your project and get a clear plan and quote.", 25000, 60),
    s("Monthly Retainer", "Ongoing support each month at a fixed, predictable price.", 100000),
  ],
  Agency: [
    s("One-hour Strategy Call", "Walk through your goals and get practical recommendations.", 15000, 60),
    s("Project Discovery Session", "Scope your project and get a clear plan and quote.", 25000, 60),
    s("Monthly Retainer", "Ongoing support each month at a fixed, predictable price.", 100000),
  ],
  "Software Development": [
    s("Technical Consultation", "A one-hour call to review your idea and recommend an approach.", 20000, 60),
    s("Website Build (Starter)", "A clean, fast starter website for your business.", 150000),
    s("Monthly Maintenance", "Updates, fixes and support to keep your product running.", 50000),
  ],
  "Health & Fitness": [
    s("Personal Training Session", "A one-hour session built around your fitness goals.", 10000, 60),
    s("Nutrition Consultation", "A 45-minute plan for eating well and reaching your goals.", 12000, 45),
    s("Monthly Gym Membership", "Full access to the gym for one month.", 20000),
  ],
  Automotive: [
    s("Full Car Wash", "Exterior wash, interior vacuum and tyre shine.", 5000, 60),
    s("Oil Change Service", "Engine oil and filter change with a quick safety check.", 15000, 45),
    s("Interior Detailing", "Deep clean and conditioning of seats, carpets and dashboard.", 30000, 180),
  ],
  Agriculture: [
    p("Fresh Eggs (Crate)", "A crate of farm-fresh eggs.", 4500),
    p("Farm-fresh Vegetable Box", "A mixed box of seasonal vegetables, harvested to order.", 7000),
    p("Cassava Flour (5kg)", "Clean, finely milled cassava flour.", 5500),
  ],
  Logistics: [
    s("Same-day Delivery (Within City)", "Fast pickup and delivery of parcels within the city.", 3000),
    s("Interstate Parcel Delivery", "Reliable parcel delivery to major cities across Nigeria.", 8000),
    s("Bulk Cargo Pickup", "Pickup and transport of larger loads, priced by size.", 25000),
  ],
  "HR & Recruitment": [
    s("Permanent Placement", "We source, screen and shortlist candidates for your open role.", 250000),
    s("HR Policy & Handbook Review", "A review of your HR policies with clear recommendations.", 150000),
    s("Monthly Payroll Processing", "Accurate monthly payroll, payslips and statutory deductions.", 100000),
  ],
};

const GENERIC_PRODUCTS: IdeaSeed[] = [
  p("Featured Product", "Your best-selling item. Replace this with a short description of what you sell.", 5000),
  p("Popular Item", "A customer favourite. Replace this with your own description.", 3500),
  p("Gift Bundle", "A ready-to-give bundle of your favourites.", 12000),
];

const GENERIC_SERVICES: IdeaSeed[] = [
  s("Standard Service", "Your most requested service. Replace this with your own description.", 10000, 60),
  s("Consultation", "A short call to understand what you need and recommend the next step.", 5000, 30),
  s("Premium Package", "Your full-service option with everything included.", 30000),
];

/** Business types whose listings are not simple products/services and need their own flow. */
const NO_QUICK_ADD: ReadonlySet<CanonicalBusinessType> = new Set(["Hotel & Lodging", "Real Estate", "Church"]);

function slugifyId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Starter ideas for a business type, excluding anything already in the store (by
 * name). Returned as drafts' source material only: the server action recomputes this
 * list and picks by id, so the client can never inject its own listing content.
 */
export function getStarterIdeas(
  category: CanonicalBusinessType,
  caps: { sellsProducts: boolean; offersServices: boolean },
  existingNames: string[] = [],
  max = 4
): StarterIdea[] {
  if (NO_QUICK_ADD.has(category)) return [];
  const taken = new Set(existingNames.map(normalizeName));
  const seeds =
    IDEAS[category] ?? (caps.offersServices && !caps.sellsProducts ? GENERIC_SERVICES : GENERIC_PRODUCTS);
  return seeds
    .filter((seed) => !taken.has(normalizeName(seed.name)))
    .slice(0, max)
    .map((seed) => ({ ...seed, id: slugifyId(seed.name) }));
}
