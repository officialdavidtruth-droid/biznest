import { PROFESSIONAL_SERVICE_SUBNICHES } from "@/lib/professional-services";

/**
 * Subcategories ("specialties") for every business category a seller can pick
 * at verification. Business.businessSubcategory stores the option's display
 * NAME (not its id) — the same convention Professional Services already used —
 * so renaming an option here orphans existing rows. Add new ones freely.
 *
 * Professional Services is not redefined here: its options are derived from
 * lib/professional-services.ts, which also drives its storefront niche.
 *
 * Careful with wording: other code does keyword matching on the stored name
 * (isCreativeText in lib/storefront-niche.ts looks for print/graphic/brand/
 * marketing/creative/photograph; hotelHasDining in lib/hotel-dining.ts looks
 * for restaurant/dining/cafe/bar/grill/kitchen/food/menu/catering). Keep those
 * words out of options unless that behaviour is intended for the category.
 */

export type SubcategoryOption = {
  id: string;
  name: string;
  description: string;
  /** Example text used as the placeholder of the category's main onboarding field. */
  focus: string;
  /** Replaces the category's default onboarding recommendations. */
  recommendations: string[];
  /** Optional <optgroup> label. */
  group?: string;
};

export type SubcategoryConfig = {
  /** Label of the select, e.g. "Fashion specialty". */
  label: string;
  options: SubcategoryOption[];
};

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const o = (name: string, description: string, focus: string, ...recommendations: string[]): SubcategoryOption => ({
  id: slug(name), name, description, focus, recommendations,
});

export const BUSINESS_SUBCATEGORIES: Record<string, SubcategoryConfig> = {
  "Fashion": {
    label: "Fashion specialty",
    options: [
      o("Clothing & Apparel", "Ready-to-wear clothing for men, women or everyone.", "womenswear, menswear, streetwear", "Create collections by style or season", "Add size and colour variants", "Highlight new arrivals"),
      o("Footwear", "Shoes, sandals, sneakers and boots.", "sneakers, heels, sandals, boots", "Add every size as a variant", "Show shoes from several angles", "Publish a size guide"),
      o("Bags & Accessories", "Handbags, belts, caps, scarves and other accessories.", "handbags, belts, caps, scarves", "Show close-ups of material and finish", "Group by occasion or style", "Offer gift-ready packaging"),
      o("Jewellery & Watches", "Jewellery, watches and fine accessories.", "necklaces, rings, watches", "Show close-up detail photos", "State materials and care clearly", "Explain returns and authenticity"),
      o("Tailoring & Bespoke", "Made-to-measure outfits and custom fashion by appointment.", "bespoke suits, native wear, bridal", "Show finished work in a gallery", "Add a measurement and booking flow", "State turnaround times"),
      o("Traditional & Native Wear", "Cultural and native attire, fabrics and styling.", "agbada, kaftan, asoebi, gele", "Group by occasion", "Show fabric and fit details", "Offer custom sizing"),
      o("Thrift & Pre-owned", "Second-hand and vintage fashion, one item at a time.", "thrift tops, vintage denim, bales", "Photograph each item and note its condition", "Mark sold items clearly", "Drop new stock on a regular day"),
      o("Kids & Baby Fashion", "Children's and baby clothing and accessories.", "baby wear, school wear, kids' outfits", "Organise by age range", "Add size and colour variants", "Create seasonal bundles"),
      o("Fabrics & Materials", "Fabric by the yard, lace, textiles and tailoring supplies.", "ankara, lace, aso-oke, linen", "Sell by yard or bundle", "Show colour and texture up close", "List minimum order lengths"),
      o("Uniforms & Corporate Wear", "Uniforms, workwear and bulk corporate orders.", "school uniforms, workwear, scrubs", "Add a bulk-order enquiry flow", "List sizes and lead times", "Show past client work"),
    ],
  },
  "Electronics": {
    label: "Electronics specialty",
    options: [
      o("Phones & Tablets", "New and refurbished smartphones and tablets.", "iPhones, Samsung, tablets", "Add model, storage and condition details", "Show warranty information", "Keep stock levels accurate"),
      o("Laptops & Computers", "Laptops, desktops and computer hardware.", "laptops, desktops, monitors", "List key specifications clearly", "Show warranty and return terms", "Offer upgrade or trade-in options"),
      o("Phone & Computer Accessories", "Chargers, cases, cables, storage and peripherals.", "chargers, cases, earphones, cables", "Match accessories to device models", "Bundle common add-ons", "Feature best sellers"),
      o("Home Appliances", "Fridges, cookers, fans, washing machines and small appliances.", "fridges, generators, blenders, fans", "Explain delivery and installation", "State warranty terms", "Show energy and power ratings"),
      o("Audio, TV & Entertainment", "TVs, speakers, headphones and home entertainment.", "TVs, sound systems, speakers", "Show screen and sound specifications", "Offer installation and wall-mounting", "Explain warranty terms"),
      o("Solar & Power Backup", "Solar kits, inverters, batteries and power solutions.", "inverters, solar panels, batteries", "Offer ready-made power packages", "Add a site-assessment enquiry", "Explain installation and warranty"),
      o("Gaming & Consoles", "Consoles, games and gaming accessories.", "PlayStation, Xbox, controllers, games", "Keep stock levels accurate", "Show new releases first", "Offer pre-orders"),
      o("Repairs & Servicing", "Device repair, servicing and diagnostics.", "screen repair, battery swaps, diagnostics", "List repair services with prices and times", "Let customers book a drop-off", "Show warranty on repairs"),
    ],
  },
  "Food & Groceries": {
    label: "Type of food business",
    options: [
      o("Supermarket & General Groceries", "A full range of everyday groceries and household goods.", "groceries, drinks, household essentials", "Group products by aisle", "Set delivery zones", "Feature weekly deals"),
      o("Fresh Produce & Farm Foods", "Fruit, vegetables, tubers and farm-fresh produce.", "vegetables, tubers, fresh fruit", "Sell by weight or bundle", "State freshness and sourcing", "Set delivery windows"),
      o("Fruits, Juices & Smoothies", "Fresh fruit, juices, smoothies and fruit baskets.", "fruit baskets, fresh juice, smoothies", "Offer subscription or weekly boxes", "Show ingredients and sizes", "Set delivery times to keep items fresh"),
      o("Meat, Fish & Poultry", "Fresh and frozen meat, fish and poultry.", "beef, chicken, fish, goat meat", "Sell by weight or cut", "State storage and delivery handling", "Set delivery windows"),
      o("Bakery & Pastries", "Bread, cakes, pastries and baked goods.", "bread, cakes, pastries, small chops", "Offer custom cake orders", "State lead times", "Show sizes and flavours"),
      o("Drinks & Beverages", "Soft drinks, water, juices, wine and other drinks.", "soft drinks, water, juice, wine", "Sell by bottle, pack or crate", "Offer bulk and event pricing", "Set delivery rules for heavy orders"),
      o("Snacks & Packaged Foods", "Snacks, spices, cereals and packaged foods.", "snacks, spices, cereals, noodles", "Create bundles and gift boxes", "Show ingredients and shelf life", "Feature best sellers"),
      o("Frozen & Ready Meals", "Frozen foods, meal prep and ready-to-eat meals.", "frozen meals, soups, meal prep", "State storage and reheating instructions", "Set cold-chain delivery windows", "Offer weekly meal plans"),
      o("Health & Organic Foods", "Organic, natural and specialty-diet foods.", "organic foods, honey, gluten-free", "Show ingredient and sourcing details", "Label diets clearly", "Share the story behind your products"),
    ],
  },
  "Restaurant": {
    label: "Type of restaurant",
    options: [
      o("Restaurant & Dine-in", "A sit-down restaurant with a full menu and reservations.", "Nigerian, continental, grills", "Build your menu around categories", "Add signature dishes", "Set opening hours and reservations"),
      o("Fast Food & Takeaway", "Quick-service food for pickup and delivery.", "burgers, shawarma, chicken, pizza", "Keep the menu short and clear", "Configure pickup and delivery", "Add combo meals"),
      o("Cafe & Coffee Shop", "Coffee, light meals, pastries and a relaxed space.", "coffee, pastries, sandwiches", "Show your drinks menu first", "Feature the space with photos", "Add pickup ordering"),
      o("Bakery & Cafe", "Fresh baking with a cafe counter and custom orders.", "cakes, pastries, bread, coffee", "Offer custom cake orders", "State lead times", "Show daily specials"),
      o("Bar & Lounge", "Drinks, small plates, nightlife and events.", "cocktails, small plates, live music", "Show your drinks list", "Promote events and nights", "Add table reservations"),
      o("Catering & Meal Prep", "Food for events, offices and scheduled meal plans.", "events, office lunch, meal plans", "Create tiered catering packages", "Add an event enquiry form", "State minimum order sizes"),
      o("Food Truck & Street Food", "Mobile and street-food vending.", "suya, grills, wraps, street snacks", "Share your location and schedule", "Keep the menu tight", "Take pre-orders for pickup"),
      o("Cloud Kitchen", "Delivery-only kitchen with no dining room.", "delivery-only meals, multiple menus", "Configure delivery zones", "Show prep and delivery times", "Offer bundles and combos"),
    ],
  },
  "Hotel & Lodging": {
    label: "Type of accommodation",
    options: [
      o("Hotel", "A full-service hotel with rooms, amenities and front desk.", "Standard, Deluxe, Executive Suite", "Add every room type", "Show availability clearly", "Highlight amenities and location"),
      o("Guest House & Inn", "A smaller, personal stay with a handful of rooms.", "Standard, Twin, Family room", "Add every room with real photos", "State check-in and check-out times", "Show nearby landmarks"),
      o("Serviced Apartments", "Self-contained apartments for longer stays.", "studio, 1-bed, 2-bed", "State minimum stay and weekly rates", "List kitchen and laundry facilities", "Show the building and neighbourhood"),
      o("Resort & Retreat Centre", "Leisure stays with grounds, activities and packages.", "chalets, villas, day passes", "Build stay and activity packages", "Show the grounds in a gallery", "Add event and group booking"),
      o("Hostel & Budget Stay", "Affordable beds and shared or private rooms.", "dorm beds, private rooms", "Price per bed and per room", "List house rules clearly", "Show shared facilities"),
      o("Short-let & Vacation Homes", "Furnished homes and apartments for short stays.", "1-bed, 2-bed, 3-bed apartments", "Set nightly rates and cleaning fees", "State check-in instructions", "Show full photos of each home"),
    ],
  },
  "Beauty": {
    label: "Beauty specialty",
    options: [
      o("Skincare & Cosmetics", "Skincare, makeup and beauty products.", "skincare, makeup, body care", "Show ingredients and skin types", "Create routines and bundles", "Add reviews and before/after photos"),
      o("Makeup Artistry", "Makeup services for events, brides and shoots.", "bridal, event, editorial makeup", "Show a strong portfolio", "Create clear packages", "Set availability and travel areas"),
      o("Hair Products & Wigs", "Wigs, extensions, hair care and styling products.", "wigs, braids, hair care", "Show length, texture and colour", "Offer customisation and install", "Explain returns and care"),
      o("Nail Studio", "Manicures, pedicures and nail art.", "gel, acrylics, nail art", "List services with duration and price", "Show your best nail art", "Open up easy booking"),
      o("Lashes & Brows", "Lash extensions, lifts, brow shaping and tinting.", "lash extensions, brow lamination", "List services with duration and price", "Show before and after photos", "State aftercare and refill timing"),
      o("Spa & Wellness", "Massage, facials, body treatments and relaxation.", "massage, facials, body treatments", "Create treatment packages", "Introduce your therapists", "Offer gift vouchers"),
      o("Fragrance & Perfumes", "Perfumes, body mists and fragrance oils.", "perfumes, body sprays, oils", "Describe scent notes clearly", "Offer gift sets and samples", "Show size options"),
      o("Barbershop", "Cuts, grooming and beard care.", "cuts, fades, beard grooming", "List services with price and time", "Show your barbers and their work", "Open up easy booking"),
    ],
  },
  "Home & Furniture": {
    label: "Furniture and home focus",
    options: [
      o("Living Room & Sofas", "Sofas, seating, TV stands and living room furniture.", "sofas, centre tables, TV stands", "Show pieces in room settings", "State dimensions and materials", "Explain delivery and assembly"),
      o("Bedroom & Mattresses", "Beds, mattresses, wardrobes and bedroom furniture.", "beds, mattresses, wardrobes", "State sizes and mattress firmness", "Explain delivery and assembly", "Offer bedroom bundles"),
      o("Kitchen & Dining", "Dining sets, kitchen cabinets and cookware.", "dining sets, cabinets, cookware", "State seating capacity and dimensions", "Show finishes and materials", "Explain installation"),
      o("Office Furniture", "Desks, chairs and workspace furniture.", "desks, ergonomic chairs, shelving", "Offer bulk and corporate pricing", "State dimensions and materials", "Add a quote request for fit-outs"),
      o("Home Decor & Lighting", "Decor, rugs, curtains, art and lighting.", "rugs, curtains, lamps, art", "Group by room and style", "Use large lifestyle photos", "Offer gift sets"),
      o("Outdoor & Garden", "Outdoor furniture, planters and garden items.", "patio sets, planters, hammocks", "State weather resistance", "Explain delivery for large items", "Show items in real outdoor spaces"),
      o("Bespoke & Made-to-Order", "Custom-built furniture made to your measurements.", "custom wardrobes, beds, sofas", "Show finished work in a gallery", "Add a custom-order enquiry flow", "State lead times and deposits"),
    ],
  },
  "Health": {
    label: "Type of health service",
    options: [
      o("Clinic & Hospital", "General and specialist medical care.", "general practice, paediatrics, maternity", "List departments and specialists", "Add appointment booking", "Show opening and emergency hours"),
      o("Pharmacy", "Medicines, supplements and health products.", "prescriptions, supplements, baby care", "Group products by use", "State prescription rules", "Set delivery or pickup rules"),
      o("Dental Care", "Check-ups, cleaning, braces and dental treatments.", "check-ups, braces, whitening", "List treatments and who they are for", "Add appointment booking", "Show your dentists"),
      o("Diagnostic & Lab", "Lab tests, scans and screening packages.", "blood tests, scans, health screening", "Create test packages", "State preparation instructions", "Explain how results are delivered"),
      o("Eye Care & Optical", "Eye tests, glasses, contact lenses and eye care.", "eye tests, frames, lenses", "Offer eye test booking", "Show frames with sizes", "Explain lens options"),
      o("Mental Health & Counselling", "Therapy, counselling and emotional wellbeing support.", "counselling, therapy, coaching", "Introduce your practitioners", "Explain how sessions work", "Add confidential booking"),
      o("Traditional & Alternative Medicine", "Herbal, traditional and complementary health care.", "herbal care, acupuncture, wellness", "Explain your approach clearly", "State credentials and licences", "Show product ingredients"),
      o("Medical Supplies & Equipment", "Medical devices, consumables and home-care equipment.", "mobility aids, monitors, consumables", "State product specifications", "Offer bulk and facility pricing", "Explain delivery and returns"),
    ],
  },
  "Health & Fitness": {
    label: "Fitness focus",
    options: [
      o("Gym & Fitness Centre", "A gym with memberships, classes and equipment.", "memberships, classes, personal training", "Create membership tiers", "Publish your class timetable", "Show the facility in a gallery"),
      o("Personal Training", "One-to-one and small-group coaching.", "one-to-one, small-group, online", "Create session packages", "Show client results", "Set availability for bookings"),
      o("Yoga & Pilates", "Mindful movement classes and studio sessions.", "yoga, pilates, meditation", "Publish a weekly class schedule", "Offer class passes and memberships", "Introduce your instructors"),
      o("Sports & Training Academy", "Coaching and training in a specific sport.", "football, swimming, martial arts", "List programmes by age and level", "Publish term dates and fees", "Show coaches and achievements"),
      o("Nutrition & Wellness Coaching", "Diet plans, coaching and lifestyle programmes.", "meal plans, weight management", "Create programme packages", "Share success stories", "Offer a discovery call"),
      o("Fitness Equipment & Gear", "Gym equipment, activewear and supplements.", "weights, treadmills, activewear", "State specifications and dimensions", "Explain delivery and assembly", "Offer bundles and bulk pricing"),
    ],
  },
  "Automotive": {
    label: "Automotive focus",
    options: [
      o("Car Sales & Dealership", "New and used vehicles for sale.", "used cars, new cars, imports", "List mileage, year and condition", "Show full photo sets", "Add a test-drive enquiry"),
      o("Auto Parts & Accessories", "Spare parts, accessories and consumables.", "spare parts, accessories, oils", "Match parts to make and model", "Keep stock levels accurate", "State warranty and returns"),
      o("Mechanic & Repairs", "Vehicle repair, diagnostics and servicing.", "engine repair, diagnostics, servicing", "List services with price guides", "Let customers book a slot", "Show warranty on repairs"),
      o("Car Wash & Detailing", "Washing, detailing, polishing and protection.", "car wash, detailing, ceramic coating", "Create service packages by car size", "Show before and after photos", "Add booking slots"),
      o("Car Rental & Chauffeur", "Vehicle hire with or without a driver.", "self-drive, chauffeur, airport pickup", "Show vehicles with daily rates", "State deposit and insurance terms", "Add date-based booking"),
      o("Tyres & Batteries", "Tyres, batteries, fitting and replacement.", "tyres, batteries, fitting", "Match tyres to vehicle size", "Offer on-site fitting", "State warranty terms"),
      o("Motorcycles & Tricycles", "Motorbikes, tricycles, parts and servicing.", "motorcycles, tricycles, spare parts", "List specifications and condition", "Show full photo sets", "Offer financing or instalment enquiries"),
    ],
  },
  "Agriculture": {
    label: "Type of agribusiness",
    options: [
      o("Crop Farming & Produce", "Grains, vegetables, fruit and other crops.", "maize, tomatoes, yams, fruit", "Sell by weight, bag or bundle", "State harvest season and availability", "Set delivery or pickup rules"),
      o("Livestock & Poultry", "Cattle, goats, pigs, poultry and live animals.", "poultry, goats, cattle", "State breed, age and weight", "Show animals with real photos", "Explain handling and delivery"),
      o("Fish Farming", "Fresh and live fish, fingerlings and aquaculture.", "catfish, tilapia, fingerlings", "Sell by size and weight", "State freshness and delivery handling", "Offer bulk and restaurant supply"),
      o("Farm Inputs & Supplies", "Seeds, fertiliser, feed and agrochemicals.", "seeds, fertiliser, animal feed", "Group by crop or animal", "State usage guidance and safety", "Offer bulk pricing for farmers"),
      o("Farm Equipment & Machinery", "Tractors, tools, irrigation and processing equipment.", "tractors, sprayers, irrigation", "State specifications and condition", "Offer financing or hire enquiries", "Explain servicing and spare parts"),
      o("Agro-processing", "Processed farm products such as flour, oil and packaged foods.", "garri, palm oil, flour, spices", "Show packaging and sizes", "State sourcing and shelf life", "Offer wholesale pricing"),
      o("Agricultural Services & Consulting", "Farm advice, land preparation, harvesting and training.", "farm advisory, land preparation, training", "List services with clear pricing", "Add a farm-visit booking", "Show results from past farms"),
    ],
  },
  "Real Estate": {
    label: "Property focus",
    options: [
      o("Property Sales & Agency", "Houses, apartments and commercial property for sale.", "houses, apartments, commercial", "List every property with full photos", "Add a viewing request", "Show verified documents"),
      o("Rentals & Leasing", "Homes, apartments and offices for rent.", "apartments, offices, shops", "State rent, deposit and fees clearly", "Add a viewing request", "Show nearby amenities"),
      o("Short-let Apartments", "Furnished apartments rented by the night.", "studios, 1-bed, 2-bed", "Set nightly rates and house rules", "Show full photos of each unit", "Add date-based booking"),
      o("Land & Plots", "Land, plots and estates for sale.", "residential plots, farmland, estates", "Show survey and title details", "Add a site-inspection request", "State payment plans"),
      o("Property Management", "Managing properties and tenants on behalf of owners.", "tenant management, maintenance, rent collection", "Explain your management plans and fees", "Show properties you manage", "Add an owner enquiry form"),
      o("Property Development", "Developing and selling new estates and units.", "new estates, off-plan units", "Show project renders and progress", "State payment plans", "Add an enquiry and inspection flow"),
    ],
  },
  "Photography": {
    label: "Photography specialty",
    options: [
      o("Wedding & Events", "Weddings, ceremonies and event coverage.", "weddings, birthdays, corporate events", "Lead with your best galleries", "Create clear packages", "Set availability and travel areas"),
      o("Portrait & Studio", "Portraits, family and studio sessions.", "portraits, family, maternity", "Show a polished portfolio", "Offer simple session packages", "Share what to wear and expect"),
      o("Product & Commercial", "Product and business imagery for brands.", "product shots, e-commerce, catalogues", "Show before and after examples", "Price per product or batch", "State turnaround and file formats"),
      o("Fashion & Editorial", "Fashion, lookbook and editorial shoots.", "lookbooks, editorials, campaigns", "Lead with published work", "Offer day-rate and project packages", "Add a creative brief form"),
      o("Real Estate & Architectural", "Property and interior imagery.", "interiors, exteriors, listings", "Offer per-property pricing", "Show before and after edits", "State turnaround time"),
      o("Videography & Film", "Video production, edits and highlights.", "wedding films, promos, documentaries", "Embed your best showreel", "Create video packages", "State delivery formats and timelines"),
      o("Drone & Aerial", "Aerial imagery and video.", "aerial shots, surveys, events", "Show sample aerial work", "State licences and safety compliance", "Price by shoot or site"),
      o("Photo Printing & Albums", "Prints, albums, frames and photo products.", "albums, frames, canvas prints", "Show sizes and paper options", "Set production and delivery times", "Offer album bundles"),
    ],
  },
  "Software Development": {
    label: "Software specialty",
    options: [
      o("Web Development", "Websites, web apps and e-commerce builds.", "websites, web apps, e-commerce", "Show live case studies", "Create fixed-scope packages", "Add a project brief form"),
      o("Mobile App Development", "iOS and Android apps.", "iOS, Android, cross-platform", "Show apps live in the stores", "Explain your build process", "Add a project brief form"),
      o("SaaS & Product Studio", "Building software products end to end.", "SaaS, MVPs, platforms", "Show products you've shipped", "Offer MVP packages", "Explain how you work with founders"),
      o("Custom Business Software", "Internal tools, ERPs and workflow automation.", "internal tools, ERP, automation", "Show systems you've built for clients", "Offer a discovery workshop", "Explain support and maintenance"),
      o("Data & AI Solutions", "Analytics, dashboards, automation and AI.", "dashboards, automation, AI assistants", "Show measurable outcomes", "Offer a scoping call", "Explain data handling and privacy"),
      o("UI/UX & Product Design", "Interface and experience design.", "UI design, prototypes, research", "Lead with design case studies", "Package audits and sprints", "Show your process"),
      o("Cybersecurity & Infrastructure", "Security, cloud and DevOps services.", "security audits, cloud, DevOps", "Explain your assessment process", "Offer audit packages", "State certifications and SLAs"),
    ],
  },
  "Event Planning": {
    label: "Event specialty",
    options: [
      o("Wedding Planning", "Full and partial planning for weddings.", "full planning, day-of coordination", "Show your best weddings", "Create clear planning tiers", "Collect date and venue early"),
      o("Corporate Events", "Conferences, launches, retreats and company events.", "conferences, launches, retreats", "Show past client events", "Add a proposal request", "State capacity and team size"),
      o("Birthday & Private Parties", "Birthdays, showers and private celebrations.", "birthdays, baby showers, anniversaries", "Create party packages by size", "Show themes and set-ups", "Collect guest count and date early"),
      o("Event Decor & Styling", "Decor, backdrops, florals and event styling.", "backdrops, florals, table styling", "Lead with a strong gallery", "Offer decor packages", "State set-up and takedown times"),
      o("Venue & Hall Rental", "Halls and venues for hire.", "halls, gardens, banquet rooms", "State capacity and layouts", "Show availability on a calendar", "List what's included"),
      o("Event Rentals", "Chairs, tents, sound, lighting and equipment.", "chairs, tents, sound, lighting", "List items with price per day", "Show availability by date", "Explain delivery and set-up"),
      o("MC, DJ & Entertainment", "Hosts, DJs, bands and live entertainment.", "MCs, DJs, live bands", "Embed performance clips", "State packages and travel areas", "Set availability for bookings"),
    ],
  },
  "Logistics": {
    label: "Type of logistics service",
    options: [
      o("Same-Day & Dispatch Delivery", "Fast city deliveries by rider or van.", "bike dispatch, same-day, errands", "Define service zones and pricing", "Show delivery time estimates", "Make requests simple to place"),
      o("Interstate & Cargo Freight", "Long-distance haulage and freight.", "interstate haulage, cargo, trucks", "List routes and transit times", "Add a quote request", "State goods you carry and insure"),
      o("Courier & Parcel", "Parcels and documents with tracking.", "parcels, documents, tracking", "State weight and size limits", "Add parcel tracking", "Show pricing by zone"),
      o("Business & E-commerce Delivery", "Delivery partner for shops and online sellers.", "e-commerce, last-mile, bulk delivery", "Offer volume pricing", "Explain integrations and pickup", "Add a business onboarding form"),
      o("Moving & Relocation", "Home and office moving services.", "home moves, office moves, packing", "Create moving packages by size", "Add a site-survey or quote request", "State insurance and packing options"),
      o("Freight Forwarding & Clearing", "Import, export and customs clearance.", "import, export, customs clearance", "Explain your process and timelines", "Add a quote request", "State licences and coverage"),
      o("Warehousing & Fulfilment", "Storage, pick-and-pack and fulfilment.", "storage, pick and pack, fulfilment", "State storage rates and minimums", "Show the facility", "Add a fulfilment enquiry"),
    ],
  },
  "Church": {
    label: "Type of ministry",
    options: [
      o("Church / Parish", "A local congregation with services, events and giving.", "Sunday service, midweek, events", "Publish your service times", "Share sermons and announcements", "Make giving easy"),
      o("Ministry & Outreach", "Itinerant ministry, crusades and outreach.", "outreach, crusades, missions", "Share upcoming programmes", "Show impact and testimonies", "Add a partner or support option"),
      o("Fellowship & Youth Group", "Youth, student and community fellowships.", "youth, campus, community groups", "Publish meeting times", "Share events and photos", "Add a join or contact form"),
      o("Faith-Based Charity", "Charity and community work run by a faith group.", "relief, education, community work", "Tell your story and impact", "Make donating simple", "Be clear on how funds are used"),
      o("Christian Books & Media", "Books, music, sermons and faith resources.", "books, music, sermons, merchandise", "Group by author or topic", "Offer digital downloads", "Feature new releases"),
    ],
  },
};

// Professional Services is derived, so its storefront niches and this
// dropdown can never disagree.
BUSINESS_SUBCATEGORIES["Professional Services"] = {
  label: "Professional services specialty",
  options: PROFESSIONAL_SERVICE_SUBNICHES.map((n) => ({
    id: n.id,
    name: n.name,
    description: n.description,
    focus: n.services.slice(0, 3).join(", ").toLowerCase(),
    recommendations: n.onboarding.recommendations,
    group: n.group,
  })),
};

export function getSubcategoryConfig(category?: string | null): SubcategoryConfig | null {
  return category ? BUSINESS_SUBCATEGORIES[category] ?? null : null;
}

export function categoryHasSubcategories(category?: string | null): boolean {
  return getSubcategoryConfig(category) !== null;
}

export function getSubcategoryOption(category?: string | null, name?: string | null): SubcategoryOption | null {
  if (!name) return null;
  return getSubcategoryConfig(category)?.options.find((x) => x.name === name) ?? null;
}

export function isValidSubcategory(category?: string | null, name?: string | null): boolean {
  return getSubcategoryOption(category, name) !== null;
}
