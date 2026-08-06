/**
 * Starter listings, seeded automatically when a store is created (see
 * lib/actions/store.ts). Without this, a freshly created store has zero
 * products/services, and the storefront correctly hides empty sections —
 * which is right for a live store, but means every new store looks
 * completely barren before the vendor adds anything, undermining the whole
 * point of a "production-ready template." Real Shopify/WooCommerce theme
 * setups ship the same way: sample content the merchant edits or deletes,
 * never fake content shown to real customers indefinitely.
 *
 * Clearly generic/replaceable — not filler text, but not implying real
 * inventory either.
 */

export type SampleProduct = {
  kind: "product";
  name: string;
  description: string;
  price: number; // NGN
  attributes?: Record<string, unknown>;
};

export type SampleService = {
  kind: "service";
  name: string;
  description: string;
  price: number;
  isBookable?: boolean;
  durationMins?: number;
};

export type SampleListing = SampleProduct | SampleService;

export const SAMPLE_LISTINGS: Record<string, SampleListing[]> = {
  "Cleaning & Home Services": [
    { kind: "service", name: "Standard House Cleaning", description: "Dusting, vacuuming, mopping and bathroom sanitizing for homes up to 1,200 sq ft.", price: 15000, isBookable: true, durationMins: 90 },
    { kind: "service", name: "Deep Clean Package", description: "Baseboards, inside appliances, grout scrubbing and detailed edge work.", price: 35000, isBookable: true, durationMins: 180 },
    { kind: "service", name: "Office Cleaning", description: "Desks, common areas, restrooms and floors — keeps productivity spaces spotless.", price: 45000, isBookable: true, durationMins: 120 },
    { kind: "service", name: "Recurring Home Care", description: "Scheduled upkeep every 2 weeks so your home always stays guest-ready.", price: 12000, isBookable: true, durationMins: 90 },
    { kind: "service", name: "Move In / Move Out Clean", description: "Full-property reset for empty units — cabinets, closets, appliances and floors.", price: 55000, isBookable: true, durationMins: 240 },
    { kind: "service", name: "Retail & Storefront Cleaning", description: "Showroom floors, glass and shelving cleaned for a great first impression.", price: 40000, isBookable: true, durationMins: 120 },
    { kind: "service", name: "Window Cleaning Add-on", description: "Interior and exterior window washing, added to any visit.", price: 6000 },
    { kind: "service", name: "Carpet Shampoo Add-on", description: "Deep carpet and rug shampooing for high-traffic rooms.", price: 10000 },
    { kind: "service", name: "Fridge & Oven Detail", description: "Inside-and-out detailing for two of the kitchen's toughest spots.", price: 8000 },
  ],
};
