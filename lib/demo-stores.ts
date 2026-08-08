/**
 * Content for the three "live demo" storefronts — one fully populated store
 * per shipped template (Fresh & Co., Heenzy Sneaker Co., Nova Studio), seeded
 * by `npm run db:seed:demos`. These are real, permanent, ACTIVE stores at
 * fixed slugs so a visitor can click through an actual home → category →
 * product → cart → checkout journey before ever signing up. They are not
 * mockup screenshots — they're the real app, running the real template code,
 * with real (if sample) catalog, reviews, and order history for stats.
 *
 * Keep these slugs stable — /templates links directly to them.
 */

export type DemoProduct = {
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  imageQuery: string;
};

export type DemoStoreSeed = {
  slug: string;
  templateName: string; // must match a StoreTemplate.name from lib/template-themes.ts
  storeName: string;
  businessCategory: string;
  description: string;
  ownerEmail: string;
  ownerName: string;
  contactPhone: string;
  contactEmail: string;
  city: string;
  state: string;
  country: string;
  logoQuery: string;
  bannerQuery: string;
  products: DemoProduct[];
  reviews: { rating: number; comment: string; authorName: string }[];
};

export const DEMO_STORES: DemoStoreSeed[] = [
  {
    slug: "demo-fresh",
    templateName: "Fresh & Co.",
    storeName: "Fresh & Co. Market",
    businessCategory: "Grocery & Supermarket",
    description:
      "Neighborhood grocer bringing fresh produce, pantry staples, and small-batch goods to your door, same day.",
    ownerEmail: "demo-fresh@biznest.example",
    ownerName: "Amaka Nwosu",
    contactPhone: "+2348012345601",
    contactEmail: "hello@freshandco.example",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    logoQuery: "grocery store logo fresh produce",
    bannerQuery: "fresh produce market vegetables",
    products: [
      { name: "Weekly Essentials Pack", description: "Rice, beans, oil, and pasta bundle for the week.", price: 15000, compareAtPrice: 17500, category: "Groceries", imageQuery: "grocery pantry staples bundle" },
      { name: "Fresh Produce Box", description: "Seasonal fruits and vegetables, hand-picked this morning.", price: 8000, category: "Groceries", imageQuery: "fresh vegetables fruit box" },
      { name: "Farmhouse Egg Tray (30 pcs)", description: "Free-range eggs from local farms.", price: 4200, category: "Groceries", imageQuery: "egg tray farm fresh" },
      { name: "Cold-Pressed Juice Pack (6)", description: "Six bottles, no added sugar, made daily.", price: 9500, category: "Groceries", imageQuery: "cold pressed juice bottles" },
      { name: "Artisan Sourdough Loaf", description: "24-hour fermented, baked fresh every morning.", price: 3200, category: "Groceries", imageQuery: "sourdough bread loaf" },
      { name: "Premium Coffee Beans (500g)", description: "Single-origin, medium roast, whole bean.", price: 7800, compareAtPrice: 9000, category: "Groceries", imageQuery: "coffee beans bag roasted" },
      { name: "Organic Honey Jar", description: "Raw, unfiltered honey from local apiaries.", price: 6500, category: "Groceries", imageQuery: "honey jar organic" },
      { name: "Family Dinner Bundle", description: "Protein, grain, and veg for a 4-person meal.", price: 12500, category: "Groceries", imageQuery: "dinner ingredients bundle meal kit" },
    ],
    reviews: [
      { rating: 5, comment: "Produce is always fresh and delivery is fast. My go-to for weekly shopping.", authorName: "Tunde B." },
      { rating: 5, comment: "The dinner bundle saved me so much time this week — great value.", authorName: "Chioma A." },
      { rating: 4, comment: "Good quality overall, wish there were more bakery options.", authorName: "Ifeoma K." },
    ],
  },
  {
    slug: "demo-heenzy",
    templateName: "Heenzy Sneaker Co.",
    storeName: "Heenzy Sneaker Co.",
    businessCategory: "Fashion & Apparel",
    description:
      "Curated sneakers and streetwear for people who take their kicks seriously. Authenticated, limited drops, and everyday essentials.",
    ownerEmail: "demo-heenzy@biznest.example",
    ownerName: "Henry Okafor",
    contactPhone: "+2348012345602",
    contactEmail: "sales@heenzysneakers.example",
    city: "Abuja",
    state: "FCT",
    country: "Nigeria",
    logoQuery: "sneaker streetwear brand logo",
    bannerQuery: "sneaker collection streetwear display",
    products: [
      { name: "Air Runner '99 — White/Grey", description: "Retro runner silhouette, premium leather upper.", price: 68000, compareAtPrice: 82000, category: "Men's Shoes", imageQuery: "white sneakers studio shot" },
      { name: "Court Classic — Triple Black", description: "All-black low top, everyday essential.", price: 54000, category: "Men's Shoes", imageQuery: "black sneakers studio shot" },
      { name: "Trail Max — Volt", description: "High-visibility trail sneaker, aggressive tread.", price: 72000, category: "Men's Shoes", imageQuery: "trail sneakers colorful" },
      { name: "Heenzy Hoodie — Oversized", description: "Heavyweight cotton, embroidered logo.", price: 24500, category: "Fashion", imageQuery: "streetwear hoodie flatlay" },
      { name: "Canvas Low — Cream", description: "Minimalist canvas low top.", price: 41000, compareAtPrice: 48000, category: "Women's Shoes", imageQuery: "canvas sneakers cream" },
      { name: "Heenzy Cap — Snapback", description: "Structured snapback, embroidered front.", price: 12500, category: "Bags", imageQuery: "snapback cap streetwear" },
      { name: "Limited Drop — Sunset Fade", description: "Limited release, gradient upper, numbered box.", price: 95000, category: "Women's Shoes", imageQuery: "colorful gradient sneakers limited" },
      { name: "Crew Socks 3-Pack", description: "Cushioned crew socks, logo detail.", price: 6500, category: "Fashion Accessories", imageQuery: "crew socks pack" },
    ],
    reviews: [
      { rating: 5, comment: "The Sunset Fade pair is even better in person. Packaging felt premium too.", authorName: "David O." },
      { rating: 5, comment: "Fast shipping and the sizing guide was spot on.", authorName: "Ngozi E." },
      { rating: 4, comment: "Great quality, would love more colorways for the Court Classic.", authorName: "Emeka U." },
    ],
  },
  {
    slug: "demo-nova",
    templateName: "Nova Studio",
    storeName: "Nova Studio",
    businessCategory: "Creative Agency",
    description:
      "A studio built on precision, patience, and a refusal to cut corners. Brand identity, product photography, and creative direction for businesses that want to feel considered.",
    ownerEmail: "demo-nova@biznest.example",
    ownerName: "Nova Adeyemi",
    contactPhone: "+2348012345603",
    contactEmail: "studio@novastudio.example",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    logoQuery: "minimalist studio logo monogram",
    bannerQuery: "creative studio workspace minimal",
    products: [
      { name: "Brand Identity Package", description: "Logo, colour system, typography, and a full brand guide.", price: 350000, category: "Branding", imageQuery: "brand identity moodboard design" },
      { name: "Product Photography — Day Rate", description: "Full-day studio session, up to 20 finished images.", price: 180000, category: "Photography", imageQuery: "product photography studio lighting" },
      { name: "Website Design (5 pages)", description: "Custom-designed site, responsive, ready for development.", price: 420000, compareAtPrice: 480000, category: "Web Design", imageQuery: "website design mockup laptop" },
      { name: "Social Content — Monthly Retainer", description: "12 posts/month, shot, edited, and scheduled.", price: 150000, category: "Content", imageQuery: "social media content shoot" },
      { name: "Packaging Design", description: "Structural + graphic packaging design, print-ready files.", price: 220000, category: "Packaging", imageQuery: "product packaging design boxes" },
      { name: "Brand Strategy Session", description: "Half-day working session, positioning and messaging.", price: 95000, category: "Strategy", imageQuery: "creative strategy meeting whiteboard" },
      { name: "Editorial Photo Series", description: "Concept-driven shoot, 15 final retouched images.", price: 260000, category: "Photography", imageQuery: "editorial photography fashion studio" },
      { name: "Motion Teaser — 30s", description: "Short-form animated teaser for launch campaigns.", price: 190000, category: "Motion", imageQuery: "motion graphics design screen" },
    ],
    reviews: [
      { rating: 5, comment: "Nova redid our entire identity and it finally feels like us. Worth every naira.", authorName: "Fola A." },
      { rating: 5, comment: "The product photography shoot elevated our whole catalog overnight.", authorName: "Grace M." },
      { rating: 5, comment: "Meticulous, on time, and the brand guide is genuinely usable by our team.", authorName: "Segun T." },
    ],
  },
];
