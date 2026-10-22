import { getCanonicalBusinessType, type CanonicalBusinessType } from "@/lib/business-identity";
import { getProfessionalServiceSubNicheByName } from "@/lib/professional-services";

/**
 * One place that decides how a storefront's universal section pages
 * (/services, /about, /portfolio, /pricing, /contact, /faq) look and read for a
 * given kind of business.
 *
 * Before this existed, the layout archetype was a two-way guess
 * (creative ? editorial : corporate) and the hero badges, CTA band, headlines
 * and FAQ were hard-coded strings in the components, so a hotel, a salon and a
 * logistics company all rendered the same shield-icon "Published policies"
 * corporate page. Keep this file free of React/JSX so it stays unit-testable.
 */

export type Archetype = "editorial" | "corporate" | "technical" | "built";
export type NicheIcon =
  | "shield" | "check" | "clock" | "sparkles" | "calendar" | "map" | "heart"
  | "truck" | "wrench" | "scissors" | "bed" | "utensils" | "camera" | "party"
  | "dumbbell" | "users" | "package" | "church";

export type NicheBadge = { icon: NicheIcon; label: string };
/** primary = the niche's own primary CTA (Book a Stay, View Menu, ...), quote = /start-project, contact = /contact */
export type NicheBandAction = "primary" | "quote" | "contact";

export type NicheProfile = {
  key: string;
  archetype: Archetype;
  /** Name of the /services page and its nav link (Rooms, Menu, Services, ...). */
  servicesLabel: string;
  servicesHero: [string, string];
  servicesEyebrow: string;
  servicesSub: string;
  /**
   * True only for niches whose /services page legitimately lists products when
   * no services exist (a restaurant menu is made of products). For everyone
   * else /services lists services only -- products live under the catalog.
   */
  listsProducts: boolean;
  emptyServices: { title: string; body: string };
  trust: [NicheBadge, NicheBadge, NicheBadge];
  band: { eyebrow: string; heading: string; body: string; cta?: string; action: NicheBandAction };
  aboutHero: [string, string];
  pricingStrip: { eyebrow: string; heading: string; body: string; cta: string };
  faq: [string, string, string, string];
};

const GENERIC: NicheProfile = {
  key: "generic",
  archetype: "corporate",
  servicesLabel: "Services",
  servicesHero: ["Services", "Made to Matter."],
  servicesEyebrow: "OUR SERVICES",
  servicesSub: "Choose the solution that fits your needs. Every offering is presented with the same clear, premium experience.",
  listsProducts: false,
  emptyServices: { title: "Services coming soon", body: "This business hasn't published any services yet. Get in touch to find out how they can help." },
  trust: [
    { icon: "shield", label: "Business information" },
    { icon: "check", label: "Published policies" },
    { icon: "clock", label: "Contact the business" },
  ],
  band: { eyebrow: "NEED SOMETHING CUSTOM?", heading: "Tell us what you need.", body: "We can shape the right solution around your project, budget and timeline.", cta: "Start a Project", action: "quote" },
  aboutHero: ["More Than a Business,", "We Build Possibilities."],
  pricingStrip: { eyebrow: "NEED A HIGHER VOLUME?", heading: "Bulk Orders & Custom Pricing", body: "Large, recurring or corporate projects can receive a tailored package.", cta: "Request a Quote" },
  faq: ["Are prices fixed?", "Can I request a custom quote?", "How long does delivery take?", "Do you offer bulk discounts?"],
};

const p = (key: string, o: Partial<NicheProfile>): NicheProfile => ({ ...GENERIC, key, ...o });

// --- Professional-services sub-niches keep their original copy -------------
const PRO_TECHNICAL = p("pro-technical", {
  archetype: "technical",
  trust: [
    { icon: "shield", label: "Store information" },
    { icon: "check", label: "Business policies" },
    { icon: "clock", label: "Secure checkout via configured gateway" },
  ],
});
const PRO_BUILT = p("pro-built", {
  archetype: "built",
  trust: [
    { icon: "shield", label: "Licensed Crews" },
    { icon: "clock", label: "On-Schedule Delivery" },
    { icon: "sparkles", label: "Built to Spec" },
  ],
});
const PRO_EDITORIAL = p("pro-editorial", {
  archetype: "editorial",
  trust: [
    { icon: "sparkles", label: "Portfolio & case studies" },
    { icon: "check", label: "Clear project scope" },
    { icon: "clock", label: "Request a quote" },
  ],
});

const PRO_BY_ID: Record<string, NicheProfile> = {
  "web-development": PRO_TECHNICAL,
  "it-services": PRO_TECHNICAL,
  architecture: PRO_BUILT,
  engineering: PRO_BUILT,
  "construction-company": PRO_BUILT,
  "graphic-design": PRO_EDITORIAL,
  "branding-agency": PRO_EDITORIAL,
  "marketing-agency": PRO_EDITORIAL,
  "photography-studio": PRO_EDITORIAL,
  legal: GENERIC,
  accounting: GENERIC,
  "hr-recruitment": GENERIC,
  consulting: GENERIC,
};

// --- Niche profiles --------------------------------------------------------
const HOTEL = p("hotel", {
  archetype: "editorial",
  servicesLabel: "Rooms",
  servicesHero: ["Rooms & Suites", "Made for Rest."],
  servicesEyebrow: "OUR ROOMS",
  servicesSub: "Compare room types, see what's included and book your stay directly.",
  emptyServices: { title: "Rooms coming soon", body: "This property hasn't published its rooms yet. Contact us to ask about availability." },
  trust: [
    { icon: "bed", label: "Browse rooms & suites" },
    { icon: "calendar", label: "Book your stay direct" },
    { icon: "map", label: "Find us" },
  ],
  band: { eyebrow: "READY TO STAY?", heading: "Find the right room for your visit.", body: "Check availability and book directly, or contact us for special requests.", action: "primary" },
  aboutHero: ["A Stay Worth", "Coming Back To."],
  pricingStrip: { eyebrow: "TRAVELLING IN A GROUP?", heading: "Group Bookings & Special Rates", body: "Planning a longer stay, an event or a group booking? Contact us for a tailored arrangement.", cta: "Enquire Now" },
  faq: ["What are the check-in and check-out times?", "Can I book a room online?", "What amenities are included?", "How do I change or cancel a booking?"],
});

const RESTAURANT = p("restaurant", {
  archetype: "editorial",
  servicesLabel: "Menu",
  servicesHero: ["Our Menu,", "Made to Share."],
  servicesEyebrow: "THE MENU",
  servicesSub: "Browse what's on offer, then order ahead or reserve a table.",
  listsProducts: true,
  emptyServices: { title: "Menu coming soon", body: "The menu hasn't been published yet. Contact us to ask what's on today." },
  trust: [
    { icon: "utensils", label: "Full menu online" },
    { icon: "calendar", label: "Reservations & enquiries" },
    { icon: "map", label: "Find us" },
  ],
  band: { eyebrow: "HUNGRY?", heading: "Reserve a table or order ahead.", body: "See the full menu, or get in touch to book for a group or a special occasion.", action: "primary" },
  aboutHero: ["Good Food,", "Good Company."],
  pricingStrip: { eyebrow: "CATERING & LARGE ORDERS", heading: "Planning for a Crowd?", body: "Get in touch about group bookings, events and catering.", cta: "Enquire Now" },
  faq: ["Can I reserve a table?", "Do you offer delivery or pickup?", "What payment methods do you accept?", "Can I contact the restaurant directly?"],
});

const SALON = p("salon", {
  archetype: "editorial",
  servicesHero: ["Treatments", "Made for You."],
  servicesEyebrow: "OUR TREATMENTS",
  servicesSub: "Browse treatments, see pricing and durations, and book your appointment.",
  emptyServices: { title: "Treatments coming soon", body: "No treatments have been published yet. Contact us to ask about appointments." },
  trust: [
    { icon: "scissors", label: "Treatments & pricing" },
    { icon: "calendar", label: "Book an appointment" },
    { icon: "map", label: "Find us" },
  ],
  band: { eyebrow: "READY FOR YOUR APPOINTMENT?", heading: "Book your next treatment.", body: "Pick a service and a time that suits you, or contact us with any questions first.", action: "primary" },
  aboutHero: ["Where Care", "Meets Craft."],
  pricingStrip: { eyebrow: "PACKAGES & GROUPS", heading: "Planning Something Special?", body: "Ask about packages, bridal bookings and group appointments.", cta: "Enquire Now" },
  faq: ["How do I book an appointment?", "How long does each treatment take?", "Can I cancel or reschedule?", "What payment methods do you accept?"],
});

const HEALTH = p("health", {
  archetype: "corporate",
  servicesHero: ["Our Services,", "Clearly Explained."],
  servicesSub: "See what we offer, what each service involves and how to book.",
  emptyServices: { title: "Services coming soon", body: "No services have been published yet. Contact us to ask what we offer." },
  trust: [
    { icon: "heart", label: "Services & care options" },
    { icon: "calendar", label: "Request an appointment" },
    { icon: "clock", label: "Hours & contact details" },
  ],
  band: { eyebrow: "NEED TO SPEAK TO SOMEONE?", heading: "Ask us before you book.", body: "Not sure which service is right? Get in touch and our team will point you in the right direction.", cta: "Contact Us", action: "contact" },
  aboutHero: ["Who We Are", "& How We Care."],
  pricingStrip: { eyebrow: "QUESTIONS ABOUT COSTS?", heading: "Confirm Fees Before You Book", body: "Contact us to confirm fees, payment options and what's included.", cta: "Contact Us" },
  faq: ["How do I book an appointment?", "What are your opening hours?", "How can I pay for a service?", "How do I contact the clinic?"],
});

const FITNESS = p("fitness", {
  archetype: "editorial",
  servicesHero: ["Classes & Training", "Built Around You."],
  servicesEyebrow: "CLASSES & PLANS",
  servicesSub: "Explore classes, sessions and memberships, then book your spot.",
  emptyServices: { title: "Classes coming soon", body: "No classes or plans have been published yet. Contact us to ask what's available." },
  trust: [
    { icon: "dumbbell", label: "Classes & memberships" },
    { icon: "calendar", label: "Book a session" },
    { icon: "map", label: "Find us" },
  ],
  band: { eyebrow: "READY TO START?", heading: "Book your first session.", body: "Pick a class or a plan, or contact us and we'll help you choose.", action: "primary" },
  aboutHero: ["Train With", "Purpose."],
  pricingStrip: { eyebrow: "TRAINING TOGETHER?", heading: "Group & Corporate Plans", body: "Ask about plans for teams, groups and organisations.", cta: "Enquire Now" },
  faq: ["How do I book a class or session?", "What membership options are there?", "Can I cancel or freeze a plan?", "How do I contact the team?"],
});

const CLEANING = p("cleaning", {
  archetype: "editorial",
  servicesHero: ["Cleaning Services", "For Every Space."],
  servicesEyebrow: "OUR CLEANING SERVICES",
  servicesSub: "Choose a service, see what's included and request a booking or a quote.",
  emptyServices: { title: "Services coming soon", body: "No cleaning services have been published yet. Contact us for a quote." },
  trust: [
    { icon: "sparkles", label: "Clear service list" },
    { icon: "calendar", label: "Book a clean" },
    { icon: "clock", label: "Quick quotes" },
  ],
  band: { eyebrow: "NEED A CUSTOM CLEAN?", heading: "Tell us about your space.", body: "Share the size, location and timing and we'll put together a quote.", cta: "Get a Quote", action: "quote" },
  aboutHero: ["Clean Spaces,", "Less Stress."],
  pricingStrip: { eyebrow: "REGULAR OR LARGE JOBS?", heading: "Recurring & Commercial Cleaning", body: "Ask about regular schedules and tailored pricing for larger premises.", cta: "Request a Quote" },
  faq: ["How do I book a cleaning service?", "Do you bring your own supplies?", "Can I get a quote for a large space?", "Do you offer recurring cleans?"],
});

const AUTOMOTIVE = p("automotive", {
  archetype: "built",
  servicesHero: ["Repairs & Servicing", "Done Right."],
  servicesEyebrow: "WHAT WE WORK ON",
  servicesSub: "See what we work on, then request a slot or a quote.",
  emptyServices: { title: "Services coming soon", body: "No services have been published yet. Contact us to ask about your vehicle." },
  trust: [
    { icon: "wrench", label: "Repairs & servicing" },
    { icon: "calendar", label: "Book a slot" },
    { icon: "clock", label: "Request a quote" },
  ],
  band: { eyebrow: "NOT SURE WHAT'S WRONG?", heading: "Describe the problem.", body: "Tell us what you're seeing with your vehicle and we'll recommend the next step.", cta: "Get a Quote", action: "quote" },
  aboutHero: ["Keeping You", "On the Road."],
  pricingStrip: { eyebrow: "FLEET OR REGULAR WORK?", heading: "Fleet & Repeat Servicing", body: "Ask about tailored pricing for fleets and recurring servicing.", cta: "Request a Quote" },
  faq: ["How do I book a service?", "Can I get a quote before work starts?", "How long will my vehicle take?", "What payment methods do you accept?"],
});

const EVENTS = p("events", {
  archetype: "editorial",
  servicesHero: ["Event Services", "For Every Occasion."],
  servicesEyebrow: "OUR EVENT SERVICES",
  servicesSub: "Explore what we plan and deliver, then tell us about your date.",
  emptyServices: { title: "Services coming soon", body: "No event services have been published yet. Tell us about your event and we'll get back to you." },
  trust: [
    { icon: "party", label: "Event services" },
    { icon: "calendar", label: "Check your date" },
    { icon: "users", label: "Plan with our team" },
  ],
  band: { eyebrow: "HAVE A DATE IN MIND?", heading: "Tell us about your event.", body: "Share the occasion, date and guest count and we'll shape a proposal.", cta: "Plan My Event", action: "quote" },
  aboutHero: ["We Plan.", "You Celebrate."],
  pricingStrip: { eyebrow: "LARGE OR MULTI-DAY EVENTS?", heading: "Custom Event Packages", body: "Ask for a tailored proposal for larger or multi-day events.", cta: "Request a Proposal" },
  faq: ["How far ahead should I book?", "Can you work to my budget?", "Do you handle venues and vendors?", "How do I request a quote?"],
});

const LOGISTICS = p("logistics", {
  archetype: "built",
  servicesHero: ["Moving Things,", "Made Simple."],
  servicesEyebrow: "DELIVERY & FREIGHT",
  servicesSub: "See what we move and where we operate, then request a quote.",
  emptyServices: { title: "Services coming soon", body: "No services have been published yet. Contact us to request a delivery quote." },
  trust: [
    { icon: "truck", label: "Delivery & freight services" },
    { icon: "map", label: "Coverage areas" },
    { icon: "clock", label: "Request a quote" },
  ],
  band: { eyebrow: "NEED SOMETHING MOVED?", heading: "Request a delivery quote.", body: "Tell us what, where and when and we'll confirm options and pricing.", cta: "Get a Quote", action: "quote" },
  aboutHero: ["Moving Business", "Forward."],
  pricingStrip: { eyebrow: "REGULAR OR HIGH-VOLUME SHIPPING?", heading: "Contract & Volume Rates", body: "Ask about tailored rates for recurring and high-volume deliveries.", cta: "Request a Quote" },
  faq: ["How do I request a delivery?", "Which areas do you cover?", "How is pricing calculated?", "How long does delivery take?"],
});

const PHOTOGRAPHY = p("photography", {
  archetype: "editorial",
  servicesHero: ["Photography", "That Tells Your Story."],
  servicesEyebrow: "SESSIONS & PACKAGES",
  servicesSub: "Explore sessions and packages, then check availability for your date.",
  emptyServices: { title: "Packages coming soon", body: "No sessions or packages have been published yet. Contact us to talk about your shoot." },
  trust: [
    { icon: "camera", label: "Sessions & packages" },
    { icon: "sparkles", label: "See the portfolio" },
    { icon: "calendar", label: "Check availability" },
  ],
  band: { eyebrow: "READY TO BOOK A SHOOT?", heading: "Let's plan your session.", body: "Tell us about the occasion and your date and we'll recommend a package.", cta: "Check Availability", action: "quote" },
  aboutHero: ["Moments Worth", "Keeping."],
  pricingStrip: { eyebrow: "PACKAGES & EXTRAS", heading: "Need Something Bespoke?", body: "Ask about custom coverage, albums and add-ons.", cta: "Request a Quote" },
  faq: ["How do I book a session?", "How long until I receive my photos?", "Can I customise a package?", "Do you travel for shoots?"],
});

const CHURCH = p("church", {
  archetype: "editorial",
  servicesHero: ["Services &", "Ministries."],
  servicesEyebrow: "SERVICES & MINISTRIES",
  servicesSub: "Find service times, ministries and ways to get involved.",
  emptyServices: { title: "Details coming soon", body: "Service times and ministries haven't been published yet. Reach out and we'll be glad to help." },
  trust: [
    { icon: "church", label: "Services & events" },
    { icon: "heart", label: "Get involved" },
    { icon: "map", label: "Visit us" },
  ],
  band: { eyebrow: "NEW HERE?", heading: "We'd love to meet you.", body: "Reach out with questions or plan a visit.", cta: "Contact Us", action: "contact" },
  aboutHero: ["A Community", "to Belong To."],
  pricingStrip: { eyebrow: "GIVING & SUPPORT", heading: "Ways to Give", body: "Get in touch to learn how you can support our work.", cta: "Contact Us" },
  faq: ["When are your services?", "How can I get involved?", "Where are you located?", "How do I contact the church?"],
});

const COMMERCE = p("commerce", {
  archetype: "editorial",
  servicesHero: ["Our Services,", "Beyond the Shelf."],
  servicesSub: "Extra services offered alongside our products.",
  emptyServices: { title: "No services yet", body: "This store hasn't published any services. Browse the catalog to see what's on offer." },
  trust: [
    { icon: "package", label: "Shop the full catalog" },
    { icon: "shield", label: "Online checkout" },
    { icon: "clock", label: "Contact the store" },
  ],
  band: { eyebrow: "LOOKING FOR SOMETHING SPECIFIC?", heading: "Can't find what you need?", body: "Get in touch and we'll help you find the right product or arrange a special order.", cta: "Contact Us", action: "contact" },
  aboutHero: ["Made for the Way", "You Shop."],
  faq: ["Do I need an account to order?", "What payment methods do you accept?", "How do I track my order?", "Do you offer bulk discounts?"],
});

const BY_TYPE: Partial<Record<CanonicalBusinessType, NicheProfile>> = {
  "Hotel & Lodging": HOTEL,
  Restaurant: RESTAURANT,
  Salon: SALON,
  Beauty: SALON,
  Health: HEALTH,
  "Health & Fitness": FITNESS,
  Cleaning: CLEANING,
  Automotive: AUTOMOTIVE,
  "Event Planning": EVENTS,
  Logistics: LOGISTICS,
  Photography: PHOTOGRAPHY,
  Church: CHURCH,
  Agency: PRO_EDITORIAL,
  "Software Development": PRO_TECHNICAL,
  Construction: PRO_BUILT,
  Fashion: COMMERCE,
  Electronics: COMMERCE,
  Retail: COMMERCE,
  "Food & Groceries": COMMERCE,
  "Home & Furniture": COMMERCE,
  Agriculture: COMMERCE,
  "Real Estate": COMMERCE,
};

/** Legacy keyword heuristic for uncategorised ("Other") businesses. */
export function isCreativeText(raw: string): boolean {
  const r = raw.toLowerCase();
  return ["print", "graphic", "brand", "marketing", "creative", "photograph"].some((k) => r.includes(k));
}

export type NicheInput = {
  business?: { category?: string | null; businessSubcategory?: string | null } | null;
  businessType?: string | null;
};

export function nicheFor(store: NicheInput): NicheProfile {
  const subcategory = store.business?.businessSubcategory;
  // businessSubcategory stores the sub-niche's display name, not its slug id.
  const subId = getProfessionalServiceSubNicheByName(subcategory)?.id;
  if (subId && PRO_BY_ID[subId]) return PRO_BY_ID[subId];

  const type = getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType });
  const byType = BY_TYPE[type];
  if (byType) return byType;

  const raw = `${store.business?.category || ""} ${subcategory || ""}`;
  return isCreativeText(raw) ? PRO_EDITORIAL : GENERIC;
}

// --- /services behaviour ----------------------------------------------------

export type ServicesListing<T> =
  | { mode: "list"; items: T[] }
  | { mode: "redirect-to-catalog" }
  | { mode: "empty" };

/**
 * Decides what /services shows. Services are always listed first. Products are
 * only ever listed for niches whose "services" page is really a product list
 * (restaurant menus). A store that only has products is sent to its catalog
 * instead of showing products under a "Services" heading.
 */
export function resolveServicesListing<T>(niche: NicheProfile, services: T[], products: T[]): ServicesListing<T> {
  if (services.length) return { mode: "list", items: services };
  if (niche.listsProducts && products.length) return { mode: "list", items: products };
  if (products.length) return { mode: "redirect-to-catalog" };
  return { mode: "empty" };
}

/**
 * Header/footer link for the services slot. A store with products but no
 * services gets a "Shop" link to the catalog rather than a "Services" link
 * that leads nowhere useful.
 */
export function servicesNavLink(niche: NicheProfile, hasServices: boolean, hasProducts: boolean): [label: string, path: string] {
  if (!hasServices && hasProducts && !niche.listsProducts) return ["Shop", "catalog"];
  return [niche.servicesLabel, "services"];
}
