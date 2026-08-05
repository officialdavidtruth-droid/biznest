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
 * Two items per niche, clearly generic/replaceable — not filler text, but
 * not implying real inventory either. Real estate includes attributes
 * (bedrooms, lat/lng) so the map/filter feature also has something to show
 * immediately rather than needing manual setup first.
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
  "Restaurant & Food Delivery": [
    { kind: "product", name: "Signature Jollof (large)", description: "Our house special, feeds 2–3.", price: 4500 },
    { kind: "product", name: "Grilled Chicken Combo", description: "Grilled chicken, rice, and coleslaw.", price: 6000 },
  ],
  "Hotel & Short-let": [
    { kind: "product", name: "Standard Room — 1 night", description: "Queen bed, en-suite, breakfast included.", price: 25000 },
    { kind: "product", name: "Deluxe Suite — 1 night", description: "King bed, lounge area, city view.", price: 55000 },
  ],
  "Fashion & Apparel": [
    { kind: "product", name: "Ankara Two-Piece Set", description: "Custom-tailored, made to order.", price: 18500 },
    { kind: "product", name: "Everyday Tote Bag", description: "Handcrafted leather tote.", price: 9500 },
  ],
  "Beauty & Cosmetics": [
    { kind: "product", name: "Glow Serum", description: "Vitamin C brightening serum, 30ml.", price: 8500 },
    { kind: "product", name: "Signature Gift Set", description: "Skincare essentials, gift-boxed.", price: 15000 },
  ],
  "Electronics & Gadgets": [
    { kind: "product", name: "Wireless Earbuds", description: "Noise-cancelling, 24hr battery.", price: 22000 },
    { kind: "product", name: "Fast Charger (65W)", description: "USB-C, compatible with most laptops and phones.", price: 12000 },
  ],
  "Grocery & Supermarket": [
    { kind: "product", name: "Weekly Essentials Pack", description: "Rice, beans, oil, and pasta bundle.", price: 15000 },
    { kind: "product", name: "Fresh Produce Box", description: "Seasonal fruits and vegetables.", price: 8000 },
  ],
  "Furniture & Home Decor": [
    { kind: "product", name: "Oak Dining Chair", description: "Solid oak, handcrafted finish.", price: 45000 },
    { kind: "product", name: "Woven Table Runner", description: "Handwoven, natural fibers.", price: 6500 },
  ],
  "Photography Studio": [
    { kind: "service", name: "Portrait Session", description: "1 hour studio session, 10 edited photos.", price: 35000, isBookable: true, durationMins: 60 },
    { kind: "service", name: "Product Photography (per item)", description: "Clean, e-commerce-ready shots.", price: 5000 },
  ],
  "Videography & Film": [
    { kind: "service", name: "Event Highlight Reel", description: "3–5 minute edited highlight video.", price: 80000, isBookable: true, durationMins: 240 },
    { kind: "service", name: "Full Wedding Film", description: "Full-day coverage, cinematic edit.", price: 250000, isBookable: true, durationMins: 480 },
  ],
  "Creative Agency": [
    { kind: "service", name: "Brand Identity Package", description: "Logo, colors, typography, brand guide.", price: 150000 },
    { kind: "service", name: "Social Media Management (monthly)", description: "Content calendar, posts, and reporting.", price: 90000 },
  ],
  "Law Firm & Legal Services": [
    { kind: "service", name: "Initial Consultation", description: "30-minute case review.", price: 15000, isBookable: true, durationMins: 30 },
    { kind: "service", name: "Contract Review", description: "Review and redline of a single contract.", price: 40000 },
  ],
  "Hospital & Clinic": [
    { kind: "service", name: "General Consultation", description: "Book a visit with a general practitioner.", price: 8000, isBookable: true, durationMins: 30 },
    { kind: "service", name: "Full Health Screening", description: "Comprehensive lab panel and review.", price: 35000, isBookable: true, durationMins: 60 },
  ],
  Pharmacy: [
    { kind: "product", name: "First Aid Kit", description: "Complete home first aid kit.", price: 7500 },
    { kind: "product", name: "Multivitamin (30 tablets)", description: "Daily multivitamin supplement.", price: 4500 },
  ],
  "Auto Repair & Mechanic": [
    { kind: "service", name: "Full Diagnostic Check", description: "Computerized diagnostic scan and report.", price: 10000, isBookable: true, durationMins: 45 },
    { kind: "service", name: "Oil Change & Service", description: "Oil, filter, and general inspection.", price: 18000, isBookable: true, durationMins: 60 },
  ],
  "Hair & Beauty Salon": [
    { kind: "service", name: "Cut & Style", description: "Wash, cut, and style.", price: 8000, isBookable: true, durationMins: 45 },
    { kind: "service", name: "Full Color Service", description: "Consultation, color, and treatment.", price: 25000, isBookable: true, durationMins: 120 },
  ],
  "Spa & Wellness": [
    { kind: "service", name: "Swedish Massage (60 min)", description: "Full-body relaxation massage.", price: 20000, isBookable: true, durationMins: 60 },
    { kind: "service", name: "Signature Facial", description: "Deep cleanse and hydration facial.", price: 15000, isBookable: true, durationMins: 45 },
  ],
  "Church & Ministry": [
    { kind: "service", name: "Sunday Service", description: "Weekly worship service.", price: 0 },
    { kind: "service", name: "Bible Study (Wednesdays)", description: "Weekly midweek study group.", price: 0 },
  ],
  "School & Education": [
    { kind: "service", name: "Term Enrollment", description: "Full-term enrollment, all materials included.", price: 120000 },
    { kind: "service", name: "Weekend Tutoring Program", description: "Small-group tutoring, 4 sessions/month.", price: 30000 },
  ],
  "Construction & Contracting": [
    { kind: "service", name: "Site Assessment & Quote", description: "On-site visit and detailed project quote.", price: 25000, isBookable: true, durationMins: 90 },
    { kind: "service", name: "Renovation (per project)", description: "Custom quote based on scope — starting price shown.", price: 500000 },
  ],
  "Architecture & Design Studio": [
    { kind: "service", name: "Concept Design Package", description: "Initial concept drawings and 3D renders.", price: 350000 },
    { kind: "service", name: "Site Consultation", description: "On-site assessment and feasibility review.", price: 30000, isBookable: true, durationMins: 90 },
  ],
  "Engineering Services": [
    { kind: "service", name: "Structural Assessment", description: "Full structural review and report.", price: 150000 },
    { kind: "service", name: "Consultation (hourly)", description: "Technical consultation, billed per hour.", price: 25000, isBookable: true, durationMins: 60 },
  ],
  "Real Estate & Property": [
    { kind: "product", name: "3-Bedroom Duplex — Lekki", description: "Modern duplex, gated estate, 24/7 power.", price: 85000000, attributes: { bedrooms: 3, bathrooms: 3, areaSqm: 220, address: "Lekki Phase 1, Lagos", lat: 6.4432, lng: 3.4726, listingType: "sale" } },
    { kind: "product", name: "2-Bedroom Flat — Wuse II", description: "Furnished, serviced apartment, short-let ready.", price: 4500000, attributes: { bedrooms: 2, bathrooms: 2, areaSqm: 110, address: "Wuse II, Abuja", lat: 9.0833, lng: 7.4833, listingType: "rent" } },
  ],
  "Freelancer & Portfolio": [
    { kind: "service", name: "Project-Based Work", description: "Custom scope, quoted per project.", price: 100000 },
    { kind: "service", name: "Monthly Retainer", description: "Ongoing work, fixed monthly hours.", price: 250000 },
  ],
};
