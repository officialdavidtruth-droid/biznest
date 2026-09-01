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
  return (category && PRESETS[category]) || DEFAULT_PRESET;
}
