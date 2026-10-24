import { canonicalizeBusinessType } from "@/lib/business-identity";
// Drives the niche-flexible parts of the catalog item form (ProductForm):
// the row of "quick spec" inputs under Basic Information, the right-hand
// Specifications panel, the Item Options toggles, the sidebar tips, and a
// couple of labels/wording. None of these are real database columns -- they
// all get folded into Product.attributes (see lib/validations/product.ts),
// so adding or tweaking a niche here never needs a migration.
//
// Icons are referenced by name (keyof typeof import("lucide-react")) rather
// than imported here, since this file is also read from server components;
// product-form.tsx resolves the name to a component via ICON_MAP.

export type QuickSpecField = {
  key: string;
  label: string;
  icon: string;
  placeholder?: string;
  unit?: string;
  type: "number" | "select" | "text";
  options?: string[];
};

export type SpecField = { key: string; label: string; unit?: string; placeholder?: string };

export type ItemOptionField = { key: string; label: string; hint: string; icon: string };

export type CatalogItemPreset = {
  sectionLabel: string;
  availabilityOptions: string[];
  quickSpecs: QuickSpecField[];
  specificationsLabel: string;
  specificationsHint: string;
  specFields: SpecField[];
  itemOptions: ItemOptionField[];
  tips: string[];
  importLabel: string | null;
  imagesHint: string;
};

const DEFAULT_ITEM_OPTIONS: ItemOptionField[] = [
  { key: "featured", label: "Featured item", hint: "Show in featured section", icon: "Star" },
  { key: "allowSpecialRequests", label: "Allow special requests", hint: "Customers can add special notes", icon: "MessageSquare" },
  { key: "taxable", label: "Taxable item", hint: "This item is subject to tax", icon: "Receipt" },
];

const DEFAULT_TIPS = [
  "Use a clear and descriptive name",
  "Add high quality images",
  "Provide accurate pricing",
  "Keep descriptions short but appealing",
];

const PRESETS: Record<string, CatalogItemPreset> = {
  Restaurant: {
    sectionLabel: "Menu Section",
    availabilityOptions: ["Available", "Out of Stock", "Coming Soon"],
    quickSpecs: [
      { key: "prepTime", label: "Preparation Time", icon: "Clock3", placeholder: "e.g. 25", unit: "mins", type: "number" },
      { key: "calories", label: "Calories (Optional)", icon: "Flame", placeholder: "e.g. 650", unit: "kcal", type: "number" },
      { key: "spiceLevel", label: "Spice Level", icon: "Soup", type: "select", options: ["None", "Mild", "Medium", "Hot", "Extra Hot"] },
    ],
    specificationsLabel: "Nutritional Information",
    specificationsHint: "Optional — helps health-conscious guests",
    specFields: [
      { key: "protein", label: "Protein", unit: "g", placeholder: "e.g. 22" },
      { key: "carbohydrates", label: "Carbohydrates", unit: "g", placeholder: "e.g. 65" },
      { key: "fat", label: "Fat", unit: "g", placeholder: "e.g. 18" },
      { key: "fiber", label: "Fiber", unit: "g", placeholder: "e.g. 3" },
    ],
    itemOptions: DEFAULT_ITEM_OPTIONS,
    tips: [
      "Use a clear and descriptive name",
      "Add high quality images",
      "Provide accurate pricing",
      "Keep descriptions short but appealing",
    ],
    importLabel: "Import Menu",
    imagesHint: "Upload high quality images to make your menu item more appealing",
  },
  "Hotel & Lodging": {
    sectionLabel: "Room Category",
    availabilityOptions: ["Available", "Fully Booked", "Under Maintenance"],
    quickSpecs: [
      { key: "maxGuests", label: "Max Guests", icon: "Users", placeholder: "e.g. 2", type: "number" },
      { key: "roomSize", label: "Room Size", icon: "Ruler", placeholder: "e.g. 28", unit: "sqm", type: "number" },
      { key: "bedType", label: "Bed Type", icon: "BedDouble", type: "select", options: ["Single", "Double", "Queen", "King", "Twin"] },
    ],
    specificationsLabel: "Room Amenities",
    specificationsHint: "Optional — shown on the room detail page",
    specFields: [
      { key: "wifi", label: "Wi-Fi", placeholder: "e.g. Free high-speed" },
      { key: "view", label: "View", placeholder: "e.g. Ocean view" },
      { key: "breakfast", label: "Breakfast", placeholder: "e.g. Included" },
      { key: "floor", label: "Floor", placeholder: "e.g. 4th" },
    ],
    itemOptions: [
      { key: "featured", label: "Featured room", hint: "Show in featured section", icon: "Star" },
      { key: "allowSpecialRequests", label: "Allow special requests", hint: "Guests can add special notes", icon: "MessageSquare" },
      { key: "taxable", label: "Taxable item", hint: "This room is subject to tax", icon: "Receipt" },
    ],
    tips: ["Use a clear and descriptive room name", "Add high quality room photos", "Provide accurate nightly pricing", "List amenities guests care about"],
    importLabel: null,
    imagesHint: "Upload high quality photos of this room to help guests picture their stay",
  },
  "Real Estate": {
    sectionLabel: "Property Type",
    availabilityOptions: ["Available", "Under Offer", "Sold / Let"],
    quickSpecs: [
      { key: "bedrooms", label: "Bedrooms", icon: "BedDouble", placeholder: "e.g. 3", type: "number" },
      { key: "bathrooms", label: "Bathrooms", icon: "Bath", placeholder: "e.g. 2", type: "number" },
      { key: "area", label: "Area", icon: "Ruler", placeholder: "e.g. 180", unit: "sqm", type: "number" },
    ],
    specificationsLabel: "Property Specifications",
    specificationsHint: "Optional — helps buyers compare listings",
    specFields: [
      { key: "parking", label: "Parking Spaces", placeholder: "e.g. 2" },
      { key: "yearBuilt", label: "Year Built", placeholder: "e.g. 2019" },
      { key: "furnishing", label: "Furnishing", placeholder: "e.g. Fully furnished" },
      { key: "titleType", label: "Title Type", placeholder: "e.g. C of O" },
    ],
    itemOptions: [
      { key: "featured", label: "Featured listing", hint: "Show in featured section", icon: "Star" },
      { key: "allowSpecialRequests", label: "Allow enquiry notes", hint: "Clients can add special notes", icon: "MessageSquare" },
      { key: "taxable", label: "Taxable item", hint: "This listing is subject to tax", icon: "Receipt" },
    ],
    tips: ["Use a clear and descriptive title", "Add high quality property photos", "Provide accurate pricing", "List specs buyers search for"],
    importLabel: null,
    imagesHint: "Upload high quality photos to make this property more appealing",
  },
  Beauty: {
    sectionLabel: "Service Category",
    availabilityOptions: ["Available", "Fully Booked", "Seasonal"],
    quickSpecs: [
      { key: "duration", label: "Duration", icon: "Clock3", placeholder: "e.g. 45", unit: "mins", type: "number" },
      { key: "skillLevel", label: "Skill Level", icon: "Sparkles", type: "select", options: ["Standard", "Senior", "Master"] },
      { key: "staffRequired", label: "Staff Required", icon: "Users", placeholder: "e.g. 1", type: "number" },
    ],
    specificationsLabel: "Service Details",
    specificationsHint: "Optional — shown on the booking page",
    specFields: [
      { key: "productsUsed", label: "Products Used", placeholder: "e.g. Organic-based" },
      { key: "aftercare", label: "Aftercare Notes", placeholder: "e.g. Avoid water for 4 hours" },
    ],
    itemOptions: DEFAULT_ITEM_OPTIONS.map((o) => (o.key === "taxable" ? o : o.key === "allowSpecialRequests" ? { ...o, hint: "Clients can add special notes" } : o)),
    tips: ["Use a clear and descriptive service name", "Add before/after or gallery photos", "Provide accurate pricing", "Keep descriptions short but appealing"],
    importLabel: null,
    imagesHint: "Upload high quality photos to showcase this service",
  },
};

PRESETS.Salon = PRESETS.Beauty;

// Compact builder for the remaining niches so each one gets its own labels and
// fields instead of the generic fallback. Keys land in Product.attributes, so
// no migration is needed.
function niche(o: {
  section: string; avail?: string[]; specs: QuickSpecField[]; specLabel: string; specHint: string; fields: SpecField[];
  tips: string[]; images: string; featured?: string; notes?: string; importLabel?: string | null;
}): CatalogItemPreset {
  return {
    sectionLabel: o.section,
    availabilityOptions: o.avail ?? ["Available", "Unavailable", "Coming Soon"],
    quickSpecs: o.specs,
    specificationsLabel: o.specLabel,
    specificationsHint: o.specHint,
    specFields: o.fields,
    itemOptions: DEFAULT_ITEM_OPTIONS.map((i) =>
      i.key === "featured" ? { ...i, label: o.featured ?? i.label } : i.key === "allowSpecialRequests" ? { ...i, hint: o.notes ?? i.hint } : i),
    tips: o.tips,
    importLabel: o.importLabel ?? null,
    imagesHint: o.images,
  };
}

const duration = (ph = "e.g. 60"): QuickSpecField => ({ key: "duration", label: "Duration", icon: "Clock3", placeholder: ph, unit: "mins", type: "number" });
const PROFESSIONAL = niche({
  section: "Service Category", avail: ["Accepting Clients", "Waitlist", "Unavailable"],
  specs: [
    { key: "engagementType", label: "Engagement Type", icon: "Sparkles", type: "select", options: ["One-off", "Retainer", "Project-based", "Hourly"] },
    { key: "turnaround", label: "Typical Turnaround", icon: "Clock3", placeholder: "e.g. 2 weeks", type: "text" },
    { key: "teamSize", label: "Team Size", icon: "Users", placeholder: "e.g. 3", type: "number" },
  ],
  specLabel: "Service Scope", specHint: "Optional — shown on the service page",
  fields: [
    { key: "deliverables", label: "Deliverables", placeholder: "e.g. Strategy document, 2 revisions" },
    { key: "requirements", label: "Client Requirements", placeholder: "e.g. Brand assets, access to accounts" },
    { key: "process", label: "Process", placeholder: "e.g. Discovery call, proposal, delivery" },
  ],
  tips: ["Describe the outcome the client gets", "Be clear about what is and isn't included", "Add portfolio or case-study images", "State pricing basis (fixed, hourly, retainer)"],
  images: "Upload portfolio or case-study images that show your work", featured: "Featured service", notes: "Clients can add project notes",
});

Object.assign(PRESETS, {
  "Professional Services": PROFESSIONAL,
  Agency: PROFESSIONAL,
  "Software Development": PROFESSIONAL,
  Photography: niche({
    section: "Package Type", avail: ["Available", "Fully Booked", "Seasonal"],
    specs: [duration("e.g. 120"), { key: "photographers", label: "Photographers", icon: "Users", placeholder: "e.g. 2", type: "number" }, { key: "editedPhotos", label: "Edited Photos", icon: "Sparkles", placeholder: "e.g. 50", type: "number" }],
    specLabel: "Package Details", specHint: "Optional — shown on the booking page",
    fields: [{ key: "delivery", label: "Delivery Time", placeholder: "e.g. 7 days" }, { key: "locations", label: "Locations", placeholder: "e.g. Studio or on-site" }, { key: "prints", label: "Prints / Albums", placeholder: "e.g. 1 album included" }],
    tips: ["Name the package by occasion", "Show sample shots from past shoots", "State what's included and delivery time", "Mention travel or overtime fees"],
    images: "Upload sample shots that represent this package",
  }),
  Construction: niche({
    section: "Service Category", avail: ["Taking Projects", "Limited Capacity", "Unavailable"],
    specs: [{ key: "projectScale", label: "Project Scale", icon: "Ruler", type: "select", options: ["Small", "Medium", "Large", "Commercial"] }, { key: "timeline", label: "Typical Timeline", icon: "Clock3", placeholder: "e.g. 8 weeks", type: "text" }, { key: "crewSize", label: "Crew Size", icon: "Users", placeholder: "e.g. 6", type: "number" }],
    specLabel: "Scope of Work", specHint: "Optional — shown on the service page",
    fields: [{ key: "materials", label: "Materials", placeholder: "e.g. Materials included" }, { key: "permits", label: "Permits", placeholder: "e.g. Handled by us" }, { key: "warranty", label: "Warranty", placeholder: "e.g. 12 months on workmanship" }],
    tips: ["Describe the type and scale of work", "Add photos of completed projects", "State what's included (materials, permits)", "Explain how quotes are given"],
    images: "Upload photos of completed projects", notes: "Clients can add site notes",
  }),
  Logistics: niche({
    section: "Service Type", avail: ["Available", "Limited Capacity", "Unavailable"],
    specs: [{ key: "deliveryWindow", label: "Delivery Window", icon: "Clock3", placeholder: "e.g. 24-48 hrs", type: "text" }, { key: "maxWeight", label: "Max Weight", icon: "Ruler", placeholder: "e.g. 50", unit: "kg", type: "number" }, { key: "coverage", label: "Coverage", icon: "Sparkles", type: "select", options: ["Intra-city", "Inter-state", "National", "International"] }],
    specLabel: "Shipping Details", specHint: "Optional — shown on the service page",
    fields: [{ key: "tracking", label: "Tracking", placeholder: "e.g. Live tracking" }, { key: "restrictions", label: "Restrictions", placeholder: "e.g. No hazardous goods" }, { key: "insurance", label: "Insurance", placeholder: "e.g. Optional cover" }],
    tips: ["State coverage areas and delivery windows", "List weight or size limits", "Mention restricted items", "Be clear about pricing basis"],
    images: "Upload photos of your fleet or service", notes: "Customers can add delivery notes",
  }),
  Automotive: niche({
    section: "Part / Service Category", avail: ["Available", "Out of Stock", "On Order"],
    specs: [{ key: "make", label: "Make / Fits", icon: "Sparkles", placeholder: "e.g. Toyota Camry 2012-2017", type: "text" }, { key: "condition", label: "Condition", icon: "Sparkles", type: "select", options: ["New", "Used", "Refurbished"] }, duration("e.g. 90")],
    specLabel: "Part / Service Details", specHint: "Optional — helps customers confirm fit",
    fields: [{ key: "partNumber", label: "Part Number", placeholder: "e.g. 04152-YZZA1" }, { key: "warranty", label: "Warranty", placeholder: "e.g. 6 months" }, { key: "brand", label: "Brand", placeholder: "e.g. Denso" }],
    tips: ["List the vehicles a part fits", "Include part numbers", "State condition and warranty", "For services, state the duration"],
    images: "Upload clear photos of the part or work done", notes: "Customers can add vehicle details",
  }),
  "Event Planning": niche({
    section: "Package Type", avail: ["Available", "Fully Booked", "Seasonal"],
    specs: [{ key: "guestCapacity", label: "Guest Capacity", icon: "Users", placeholder: "e.g. 150", type: "number" }, { key: "eventType", label: "Event Type", icon: "Sparkles", type: "select", options: ["Wedding", "Corporate", "Birthday", "Conference", "Other"] }, duration("e.g. 480")],
    specLabel: "Package Inclusions", specHint: "Optional — shown on the package page",
    fields: [{ key: "inclusions", label: "What's Included", placeholder: "e.g. Decor, MC, sound" }, { key: "exclusions", label: "Not Included", placeholder: "e.g. Catering" }, { key: "leadTime", label: "Booking Lead Time", placeholder: "e.g. 4 weeks" }],
    tips: ["Name the package by event type", "List exactly what's included", "Show photos from past events", "State required lead time"],
    images: "Upload photos from events you've delivered", notes: "Clients can add event details",
  }),
  Cleaning: niche({
    section: "Service Category", avail: ["Available", "Fully Booked", "Seasonal"],
    specs: [duration("e.g. 180"), { key: "cleaners", label: "Cleaners", icon: "Users", placeholder: "e.g. 2", type: "number" }, { key: "propertySize", label: "Property Size", icon: "Ruler", type: "select", options: ["Studio", "1-2 Bedrooms", "3-4 Bedrooms", "5+ Bedrooms", "Commercial"] }],
    specLabel: "Service Details", specHint: "Optional — shown on the booking page",
    fields: [{ key: "included", label: "Included Tasks", placeholder: "e.g. Floors, bathrooms, kitchen" }, { key: "supplies", label: "Supplies", placeholder: "e.g. Supplied by us" }],
    tips: ["List the tasks included", "State the property size covered", "Say whether supplies are provided", "Add before/after photos"],
    images: "Upload before/after photos of your work", notes: "Clients can add access instructions",
  }),
  Health: niche({
    section: "Service Category", avail: ["Available", "Fully Booked", "By Referral"],
    specs: [duration("e.g. 30"), { key: "practitioner", label: "Practitioner", icon: "Users", placeholder: "e.g. Dr. Adeyemi", type: "text" }, { key: "visitType", label: "Visit Type", icon: "Sparkles", type: "select", options: ["In-person", "Virtual", "Home visit"] }],
    specLabel: "Appointment Details", specHint: "Optional — shown on the booking page",
    fields: [{ key: "preparation", label: "Preparation", placeholder: "e.g. Fast for 8 hours" }, { key: "bring", label: "What to Bring", placeholder: "e.g. Previous test results" }],
    tips: ["Name the service clearly", "State the appointment duration", "Give preparation instructions", "Mention who delivers the service"],
    images: "Upload photos of your facility or team", notes: "Patients can add notes for the visit",
  }),
  "Health & Fitness": niche({
    section: "Program Category", avail: ["Open", "Waitlist", "Closed"],
    specs: [duration("e.g. 60"), { key: "level", label: "Level", icon: "Sparkles", type: "select", options: ["Beginner", "Intermediate", "Advanced", "All levels"] }, { key: "classSize", label: "Class Size", icon: "Users", placeholder: "e.g. 15", type: "number" }],
    specLabel: "Program Details", specHint: "Optional — shown on the program page",
    fields: [{ key: "schedule", label: "Schedule", placeholder: "e.g. Mon/Wed/Fri 6am" }, { key: "equipment", label: "Equipment", placeholder: "e.g. Mat provided" }, { key: "trainer", label: "Trainer", placeholder: "e.g. Coach Ada" }],
    tips: ["State level and class size", "Give the schedule", "Say what to bring", "Add photos of the space or classes"],
    images: "Upload photos of your classes or facility", featured: "Featured program", notes: "Members can add notes",
  }),
  Church: niche({
    section: "Program Category", avail: ["Open", "Full", "Ended"],
    specs: [{ key: "schedule", label: "Schedule", icon: "Clock3", placeholder: "e.g. Sundays 9am", type: "text" }, { key: "venue", label: "Venue", icon: "Sparkles", placeholder: "e.g. Main auditorium", type: "text" }, { key: "capacity", label: "Capacity", icon: "Users", placeholder: "e.g. 200", type: "number" }],
    specLabel: "Program Details", specHint: "Optional — shown on the program page",
    fields: [{ key: "leader", label: "Led By", placeholder: "e.g. Pastor Ade" }, { key: "audience", label: "Audience", placeholder: "e.g. Youth, couples" }],
    tips: ["State when and where it holds", "Say who it's for", "Name who leads it", "Add a welcoming photo"],
    images: "Upload photos from services or programs", featured: "Featured program", notes: "Members can add notes",
  }),
});

const RETAIL_PRODUCT = (section: string, fields: SpecField[], specs: QuickSpecField[], label: string): CatalogItemPreset => niche({
  section, avail: ["In Stock", "Out of Stock", "Pre-order"], specs, specLabel: label, specHint: "Optional — shown on the product page",
  fields, tips: DEFAULT_TIPS, images: "Upload high quality images to make this product more appealing", importLabel: "Import Products",
});
Object.assign(PRESETS, {
  // Sizes and colours are NOT free-text specs here: customers can only pick (and stock is only
  // tracked for) real variants, which are set up under Products -> Variants. A free-text
  // "Available Sizes" box looked like it did that but never produced a size picker.
  Fashion: {
    ...RETAIL_PRODUCT("Collection", [{ key: "material", label: "Material", placeholder: "e.g. 100% cotton" }, { key: "care", label: "Care Instructions", placeholder: "e.g. Machine wash cold" }, { key: "fit", label: "Fit", placeholder: "e.g. Regular" }],
      [{ key: "sizeGuide", label: "Size Guide Note", icon: "Ruler", placeholder: "e.g. Fits true to size", type: "text" }], "Product Details"),
    specificationsHint: "Optional — shown on the product page. Add sizes and colours as Variants (Products → Variants) so customers can pick them and stock is tracked per size.",
    tips: ["Add sizes and colours as Variants so customers can choose them", "Show the item on a model and flat-lay", "State the fabric, fit and care instructions", "Mention the model's height and the size worn"],
  },
  Electronics: RETAIL_PRODUCT("Product Category", [{ key: "brand", label: "Brand", placeholder: "e.g. Samsung" }, { key: "model", label: "Model", placeholder: "e.g. S24" }, { key: "warranty", label: "Warranty", placeholder: "e.g. 12 months" }, { key: "specs", label: "Key Specs", placeholder: "e.g. 8GB RAM, 256GB" }],
    [{ key: "condition", label: "Condition", icon: "Sparkles", type: "select", options: ["New", "Open box", "Refurbished", "Used"] }, { key: "warrantyMonths", label: "Warranty", icon: "Clock3", placeholder: "e.g. 12", unit: "months", type: "number" }], "Technical Specifications"),
  "Food & Groceries": RETAIL_PRODUCT("Category", [{ key: "ingredients", label: "Ingredients", placeholder: "e.g. Rice, palm oil" }, { key: "storage", label: "Storage", placeholder: "e.g. Keep refrigerated" }, { key: "shelfLife", label: "Shelf Life", placeholder: "e.g. 6 months" }],
    [{ key: "weight", label: "Weight / Size", icon: "Ruler", placeholder: "e.g. 500", unit: "g", type: "number" }, { key: "origin", label: "Origin", icon: "Sparkles", placeholder: "e.g. Nigeria", type: "text" }], "Product Information"),
  "Home & Furniture": RETAIL_PRODUCT("Product Category", [{ key: "material", label: "Material", placeholder: "e.g. Solid oak" }, { key: "assembly", label: "Assembly", placeholder: "e.g. Required" }, { key: "warranty", label: "Warranty", placeholder: "e.g. 2 years" }],
    [{ key: "dimensions", label: "Dimensions", icon: "Ruler", placeholder: "e.g. 120x60x75 cm", type: "text" }, { key: "colors", label: "Colors / Finish", icon: "Sparkles", placeholder: "e.g. Walnut", type: "text" }], "Product Specifications"),
  Agriculture: RETAIL_PRODUCT("Product Category", [{ key: "harvestDate", label: "Harvest / Produced", placeholder: "e.g. Oct 2026" }, { key: "storage", label: "Storage", placeholder: "e.g. Cool, dry place" }, { key: "certification", label: "Certification", placeholder: "e.g. Organic" }],
    [{ key: "unitSize", label: "Unit Size", icon: "Ruler", placeholder: "e.g. 50", unit: "kg", type: "number" }, { key: "origin", label: "Origin / Farm", icon: "Sparkles", placeholder: "e.g. Kaduna", type: "text" }], "Product Details"),
});

const DEFAULT_PRESET: CatalogItemPreset = {
  sectionLabel: "Section",
  availabilityOptions: ["Available", "Out of Stock", "Coming Soon"],
  quickSpecs: [],
  specificationsLabel: "Additional Specifications",
  specificationsHint: "Optional — add any details specific to this item",
  specFields: [],
  itemOptions: DEFAULT_ITEM_OPTIONS,
  tips: DEFAULT_TIPS,
  importLabel: null,
  imagesHint: "Upload high quality images to make this item more appealing",
};

export function getCatalogItemPreset(category?: string | null): CatalogItemPreset {
  return (category && (PRESETS[category] ?? PRESETS[canonicalizeBusinessType(category)])) || DEFAULT_PRESET;
}
