export type BusinessTerminology = {
  customer: string;
  transaction: string;
  catalog: string;
  catalogSingular: string;
  category: string;
  categoriesIntro: string;
  catalogDescription: string;
  addCatalog: string;
  emptyCatalog: string;
  // Sidebar/page-title label for the catalog management area, e.g. "Menu
  // Management" for a restaurant, "Products Management" for a generic
  // retailer -- one consistent pattern across every niche.
  catalogPageTitle: string;
  // What a unit-based booking (Booking + ServiceUnit) is called when it has
  // a table/room/unit attached -- "Reservations" for a restaurant or hotel,
  // falls back to "Bookings" for appointment-style niches with no unit.
  reservationLabel: string;
  // The generic term for one seat/table/room slot this niche's reservations
  // attach to, e.g. "Table" for a restaurant, "Room" for a hotel.
  unitLabel: string;
};

const CATALOG_TERMS: Record<string, { customer: string; transaction: string; catalog: string; reservationLabel?: string; unitLabel?: string }> = {
  Restaurant: { customer: "Guest", transaction: "Order", catalog: "Menu", reservationLabel: "Reservations", unitLabel: "Table" },
  "Hotel & Lodging": { customer: "Guest", transaction: "Reservation", catalog: "Rooms", reservationLabel: "Reservations", unitLabel: "Room" },
  Photography: { customer: "Client", transaction: "Booking", catalog: "Packages" },
  Beauty: { customer: "Client", transaction: "Appointment", catalog: "Services" },
  Salon: { customer: "Client", transaction: "Appointment", catalog: "Services" },
  "Real Estate": { customer: "Client", transaction: "Enquiry", catalog: "Properties" },
  Construction: { customer: "Client", transaction: "Project", catalog: "Services" },
  Logistics: { customer: "Client", transaction: "Delivery", catalog: "Services" },
  Automotive: { customer: "Customer", transaction: "Job", catalog: "Parts & Services" },
  "Event Planning": { customer: "Client", transaction: "Event", catalog: "Packages" },
  Cleaning: { customer: "Client", transaction: "Job", catalog: "Services" },
  "Health & Fitness": { customer: "Member", transaction: "Booking", catalog: "Programs & Services" },
  Health: { customer: "Patient", transaction: "Appointment", catalog: "Services" },
  "Food & Groceries": { customer: "Customer", transaction: "Order", catalog: "Products" },
  "Home & Furniture": { customer: "Customer", transaction: "Order", catalog: "Products" },
  Agriculture: { customer: "Customer", transaction: "Order", catalog: "Products" },
  Electronics: { customer: "Customer", transaction: "Order", catalog: "Products" },
  Fashion: { customer: "Customer", transaction: "Order", catalog: "Collections" },
};

const SINGULAR_OVERRIDES: Record<string, string> = {
  Menu: "Menu Item",
  Rooms: "Room",
  Packages: "Package",
  Services: "Service",
  Properties: "Property",
  "Parts & Services": "Part or Service",
  "Programs & Services": "Program or Service",
  Products: "Product",
  Collections: "Collection",
};

function singularize(catalog: string): string {
  if (SINGULAR_OVERRIDES[catalog]) return SINGULAR_OVERRIDES[catalog];
  if (catalog.endsWith("ies")) return `${catalog.slice(0, -3)}y`;
  if (catalog.endsWith("s")) return catalog.slice(0, -1);
  return catalog;
}

export function getBusinessTerminology(category?: string | null): BusinessTerminology {
  const base = (category && CATALOG_TERMS[category]) || { customer: "Customer", transaction: "Order", catalog: "Products" };
  const catalogSingular = singularize(base.catalog);

  return {
    ...base,
    catalogSingular,
    category: "Category",
    categoriesIntro: `Organize your ${base.catalog.toLowerCase()} into categories to make them easier to browse.`,
    catalogDescription: `Manage the ${base.catalog.toLowerCase()} customers see on your store.`,
    addCatalog: `Add ${catalogSingular}`,
    emptyCatalog: `No ${base.catalog.toLowerCase()} yet.`,
    catalogPageTitle: `${base.catalog} Management`,
    reservationLabel: base.reservationLabel ?? "Bookings",
    unitLabel: base.unitLabel ?? "Unit",
  };
}
