/**
 * Specialty profiles — what a vendor's chosen specialty (Business.businessSubcategory)
 * changes about how BizNest looks and works for them.
 *
 * Category decides the broad capability set; the specialty decides how the
 * business is *run*: what its customers, transactions and catalog are called,
 * which quick actions lead the dashboard, and which extra modules appear.
 *
 * Pure data + a lookup, no UI imports, so terminology, dashboard config and
 * navigation can all share it without circular dependencies.
 *
 * Rules are matched against the specialty's display name (the value stored on
 * Business.businessSubcategory) in order; first match wins. A category's
 * default specialty (e.g. plain "Hotel") has no rule and keeps the category
 * defaults.
 */

/** Ids resolve to dashboard modules in lib/adaptive-dashboard.ts. */
export type SpecialtyModuleId =
  | "customers" | "products" | "services" | "orders" | "pos" | "bookings" | "calendar"
  | "inventory" | "invoices" | "quotes" | "payments" | "marketing" | "reviews"
  | "analytics" | "projects" | "gallery" | "delivery" | "pms";

export type SpecialtyProfile = {
  /** Dashboard heading, e.g. "Short-let Operations". */
  label: string;
  primaryEntity: string;
  customer: string;
  transaction: string;
  catalog: string;
  reservationLabel?: string;
  unitLabel?: string;
  /** Leading quick actions, in order. */
  actions: SpecialtyModuleId[];
  /** Modules to surface in the sidebar even if the category wouldn't. */
  extraModules?: SpecialtyModuleId[];
  /** One line shown on the dashboard so the vendor sees the tuning. */
  blurb: string;
};

const p = (
  label: string, primaryEntity: string, customer: string, transaction: string, catalog: string,
  actions: SpecialtyModuleId[], blurb: string,
  more: Partial<Pick<SpecialtyProfile, "reservationLabel" | "unitLabel" | "extraModules">> = {},
): SpecialtyProfile => ({ label, primaryEntity, customer, transaction, catalog, actions, blurb, ...more });

const RULES: Record<string, Array<[RegExp, SpecialtyProfile]>> = {
  "Hotel & Lodging": [
    [/short-?let|vacation/i, p("Short-let Operations", "Stay", "Guest", "Stay", "Apartments", ["pms", "calendar", "payments", "reviews"], "Track stays, check-ins and cleaning turnovers per apartment.", { reservationLabel: "Stays", unitLabel: "Apartment" })],
    [/hostel|budget/i, p("Hostel Operations", "Booking", "Guest", "Booking", "Beds & Rooms", ["pms", "bookings", "calendar", "payments"], "Manage beds and private rooms, and who is checking in tonight.", { reservationLabel: "Bookings", unitLabel: "Bed" })],
    [/serviced/i, p("Serviced Apartments", "Stay", "Guest", "Stay", "Apartments", ["pms", "bookings", "invoices", "payments"], "Longer stays: track minimum nights, weekly rates and invoices.", { reservationLabel: "Stays", unitLabel: "Apartment" })],
    [/resort|retreat/i, p("Resort Operations", "Reservation", "Guest", "Reservation", "Rooms & Experiences", ["pms", "bookings", "services", "gallery"], "Sell rooms together with activities, day passes and packages.", { reservationLabel: "Reservations", unitLabel: "Room" })],
    [/guest house|inn/i, p("Guest House Operations", "Reservation", "Guest", "Reservation", "Rooms", ["pms", "bookings", "calendar", "reviews"], "A smaller property: rooms, availability and direct bookings.", { reservationLabel: "Reservations", unitLabel: "Room" })],
  ],
  "Travel & Tourism": [
    [/visa|document/i, p("Visa & Documentation Desk", "Application", "Client", "Application", "Visa Services", ["customers", "services", "invoices", "payments"], "Track each client's application from documents to approval.")],
    [/hajj|umrah|pilgrim/i, p("Pilgrimage Operations", "Booking", "Pilgrim", "Booking", "Packages", ["services", "bookings", "payments", "customers"], "Package tiers, group departures and instalment payments.")],
    [/car hire|transfer/i, p("Transfers & Car Hire", "Trip", "Customer", "Trip", "Vehicles & Rates", ["bookings", "calendar", "services", "customers"], "Pickups, vehicle availability and rates in one place.")],
    [/tour operator/i, p("Tour Operations", "Tour Booking", "Traveller", "Tour Booking", "Tours", ["services", "bookings", "calendar", "payments"], "Departure dates, seats sold and itineraries.")],
    [/agency/i, p("Travel Agency", "Trip", "Traveller", "Trip", "Packages", ["services", "bookings", "customers", "payments"], "Enquiries to ticketing, with client and trip records.")],
  ],
  "Restaurant": [
    [/cloud/i, p("Cloud Kitchen", "Order", "Customer", "Order", "Menu", ["orders", "products", "delivery", "analytics"], "Delivery-only: orders, prep and delivery zones come first.", { extraModules: ["delivery"] })],
    [/truck|street/i, p("Food Truck Operations", "Order", "Customer", "Order", "Menu", ["pos", "orders", "products", "analytics"], "Fast counter sales and a menu that fits a truck.")],
    [/cater|meal prep/i, p("Catering Operations", "Catering Order", "Client", "Catering Order", "Menu & Packages", ["quotes", "bookings", "orders", "customers"], "Quote events, take deposits and schedule deliveries.", { extraModules: ["quotes"] })],
    [/bar|lounge/i, p("Bar & Lounge", "Order", "Guest", "Order", "Menu", ["pos", "bookings", "products", "orders"], "Tabs, table bookings and drinks menu.")],
    [/cafe|coffee|bakery/i, p("Cafe Operations", "Order", "Customer", "Order", "Menu", ["pos", "orders", "products", "inventory"], "Quick counter orders and daily stock.")],
    [/fast food|takeaway/i, p("Takeaway Operations", "Order", "Customer", "Order", "Menu", ["orders", "pos", "delivery", "products"], "Speed matters: orders, delivery and counter sales.")],
  ],
  "Fashion": [
    [/tailor|bespoke|native|traditional|uniform/i, p("Tailoring & Custom Orders", "Custom Order", "Client", "Custom Order", "Designs", ["orders", "quotes", "customers", "products"], "Measurements, fittings, deposits and delivery dates per client.", { extraModules: ["quotes"] })],
    [/thrift|pre-owned/i, p("Thrift Store", "Order", "Customer", "Order", "Items", ["products", "orders", "inventory", "marketing"], "One-of-one stock: mark sold items and drop new stock.")],
    [/fabric|material/i, p("Fabric Store", "Order", "Customer", "Order", "Fabrics", ["products", "inventory", "orders", "quotes"], "Sell by the yard and keep roll stock accurate.")],
  ],
  "Beauty": [
    [/barber/i, p("Barbershop", "Appointment", "Client", "Appointment", "Services", ["bookings", "calendar", "services", "customers"], "Chairs, walk-ins and your barbers' schedules.")],
    [/makeup/i, p("Makeup Studio", "Booking", "Client", "Booking", "Services & Packages", ["bookings", "calendar", "gallery", "customers"], "Bridal and event bookings backed by your portfolio.")],
    [/nail|lash|brow|spa/i, p("Beauty Studio", "Appointment", "Client", "Appointment", "Services", ["bookings", "calendar", "services", "customers"], "Appointments, durations and repeat clients.")],
    [/skincare|hair|wig|fragrance|perfume/i, p("Beauty Retail", "Order", "Customer", "Order", "Products", ["products", "orders", "inventory", "marketing"], "A product shop: stock, orders and promotions.")],
  ],
  "Health": [
    [/pharmacy/i, p("Pharmacy Operations", "Order", "Customer", "Order", "Medicines & Products", ["products", "orders", "inventory", "delivery"], "Stock, expiry-sensitive inventory and deliveries.", { extraModules: ["inventory"] })],
    [/suppl|equipment/i, p("Medical Supplies", "Order", "Customer", "Order", "Supplies", ["products", "orders", "inventory", "quotes"], "Stock and quotes for clinics and individuals.")],
    [/diagnostic|lab/i, p("Diagnostic Centre", "Test Booking", "Patient", "Test Booking", "Tests", ["bookings", "calendar", "services", "customers"], "Test bookings, sample times and patient records.")],
    [/counsel|mental/i, p("Counselling Practice", "Session", "Client", "Session", "Sessions", ["bookings", "calendar", "services", "customers"], "Sessions and client scheduling.")],
    [/dental/i, p("Dental Practice", "Appointment", "Patient", "Appointment", "Treatments", ["bookings", "calendar", "services", "customers"], "Appointments, treatments and recalls.")],
  ],
  "Health & Fitness": [
    [/gym|fitness centre/i, p("Gym Operations", "Membership", "Member", "Membership", "Memberships & Classes", ["customers", "bookings", "services", "payments"], "Members, plans and class schedules.")],
    [/personal training|coaching|nutrition/i, p("Coaching Practice", "Session", "Client", "Session", "Programs & Sessions", ["bookings", "calendar", "services", "customers"], "Sessions, programs and client progress.")],
    [/yoga|pilates/i, p("Studio Operations", "Class Booking", "Member", "Class Booking", "Classes", ["bookings", "calendar", "services", "customers"], "Class timetable and bookings.")],
    [/academy/i, p("Academy Operations", "Enrolment", "Member", "Enrolment", "Programs", ["customers", "bookings", "services", "payments"], "Enrolments, sessions and fees.")],
    [/equipment|gear/i, p("Fitness Retail", "Order", "Customer", "Order", "Products", ["products", "orders", "inventory", "marketing"], "A product shop: stock and orders.")],
  ],
  "Real Estate": [
    [/short-?let/i, p("Short-let Apartments", "Booking", "Guest", "Booking", "Apartments", ["bookings", "calendar", "products", "payments"], "Nightly bookings, availability and payments.")],
    [/rental|leasing/i, p("Rental Operations", "Enquiry", "Tenant", "Enquiry", "Rentals", ["products", "customers", "invoices", "payments"], "Rental listings, tenants and rent due.")],
    [/land|plot/i, p("Land Sales", "Enquiry", "Buyer", "Enquiry", "Plots", ["products", "customers", "quotes", "marketing"], "Plots, site-visit enquiries and buyers.")],
    [/management/i, p("Property Management", "Request", "Landlord", "Request", "Properties", ["customers", "invoices", "payments", "projects"], "Landlords, maintenance requests and rent collection.")],
    [/development/i, p("Property Development", "Project", "Client", "Project", "Developments", ["projects", "products", "quotes", "customers"], "Developments, units for sale and buyer pipeline.")],
  ],
  "Event Planning": [
    [/venue|hall/i, p("Venue Operations", "Booking", "Client", "Booking", "Venues", ["bookings", "calendar", "services", "payments"], "Date availability, holds and deposits.")],
    [/rental/i, p("Event Rentals", "Rental Order", "Client", "Rental Order", "Rental Items", ["bookings", "inventory", "quotes", "customers"], "Items out, items back, and availability by date.", { extraModules: ["inventory"] })],
    [/mc|dj|entertain/i, p("Entertainment Bookings", "Gig", "Client", "Gig", "Acts & Packages", ["bookings", "calendar", "services", "customers"], "Gigs, availability and deposits.")],
    [/wedding/i, p("Wedding Planning", "Wedding", "Client", "Wedding", "Packages", ["projects", "quotes", "calendar", "customers"], "Each couple's wedding as a project with a timeline.")],
    [/corporate/i, p("Corporate Events", "Event", "Client", "Event", "Packages", ["quotes", "projects", "calendar", "invoices"], "Quotes, event projects and invoicing for companies.")],
    [/decor|styling/i, p("Decor & Styling", "Event", "Client", "Event", "Packages", ["quotes", "bookings", "gallery", "customers"], "Lead with your gallery and quote per event.")],
  ],
  "Logistics": [
    [/courier|parcel|same-day|dispatch/i, p("Dispatch Operations", "Delivery", "Customer", "Delivery", "Delivery Services", ["delivery", "bookings", "customers", "payments"], "Pickups, delivery zones and dispatch.", { extraModules: ["delivery"] })],
    [/cargo|freight|forward|clearing/i, p("Freight Operations", "Shipment", "Client", "Shipment", "Freight Services", ["quotes", "projects", "customers", "invoices"], "Quote, track shipments and invoice.")],
    [/moving|relocation/i, p("Moving Operations", "Move", "Client", "Move", "Moving Services", ["quotes", "bookings", "calendar", "customers"], "Survey quotes, move dates and crews.")],
    [/warehous|fulfil/i, p("Warehouse Operations", "Order", "Client", "Order", "Warehousing", ["inventory", "orders", "customers", "invoices"], "Stock in, orders out, storage billing.", { extraModules: ["inventory"] })],
    [/business|e-?commerce/i, p("Business Delivery", "Delivery", "Client", "Delivery", "Delivery Plans", ["delivery", "customers", "invoices", "analytics"], "Recurring deliveries for business clients.", { extraModules: ["delivery"] })],
  ],
  "HR & Recruitment": [
    [/temporary|contract/i, p("Contract Staffing", "Placement", "Client", "Placement", "Staffing Services", ["quotes", "bookings", "customers", "invoices"], "Staffing requests, quotes and invoicing per client.")],
    [/executive|search/i, p("Executive Search", "Search", "Client", "Search", "Search Services", ["quotes", "projects", "customers", "invoices"], "Each search as a project with a quote and invoice.")],
    [/payroll|outsourc/i, p("Payroll & HR Outsourcing", "Engagement", "Client", "Engagement", "Outsourcing Plans", ["quotes", "invoices", "customers", "payments"], "Recurring client plans, invoices and payments.")],
    [/consult/i, p("HR Consulting", "Engagement", "Client", "Engagement", "Consulting Services", ["bookings", "quotes", "calendar", "customers"], "Consultations, quotes and client follow-up.")],
    [/training|development/i, p("Training & Development", "Programme", "Client", "Programme", "Programmes", ["bookings", "calendar", "quotes", "customers"], "Programmes, sessions and group bookings.")],
    [/recruit|staffing/i, p("Recruitment Operations", "Placement", "Client", "Placement", "Recruitment Services", ["quotes", "projects", "customers", "invoices"], "Client requests, quotes and placements in one place.")],
  ],
  "Photography": [
    [/wedding|event/i, p("Wedding & Event Photography", "Shoot", "Client", "Shoot", "Packages", ["bookings", "calendar", "gallery", "customers"], "Shoot dates, packages and galleries.")],
    [/print|album/i, p("Prints & Albums", "Order", "Customer", "Order", "Prints & Albums", ["orders", "products", "gallery", "invoices"], "Print orders from proof to delivery.")],
    [/video|film|drone|aerial/i, p("Video & Aerial Production", "Project", "Client", "Project", "Packages", ["projects", "quotes", "gallery", "calendar"], "Projects with quotes, shoots and delivery.")],
    [/product|commercial|fashion|editorial|real estate|architect/i, p("Commercial Photography", "Project", "Client", "Project", "Packages", ["quotes", "projects", "gallery", "customers"], "Quote per brief and deliver to clients.")],
  ],
  "Automotive": [
    [/mechanic|repair/i, p("Workshop Operations", "Job", "Customer", "Job", "Repair Services", ["bookings", "quotes", "customers", "invoices"], "Job cards, quotes and invoices per vehicle.")],
    [/wash|detail/i, p("Car Wash & Detailing", "Wash", "Customer", "Wash", "Wash Packages", ["bookings", "calendar", "services", "payments"], "Packages, slots and quick payments.")],
    [/rental|chauffeur/i, p("Car Rental & Chauffeur", "Rental", "Customer", "Rental", "Vehicles", ["bookings", "calendar", "services", "payments"], "Vehicle availability, rentals and drivers.")],
    [/sales|dealership|motorcycle|tricycle/i, p("Dealership Operations", "Enquiry", "Customer", "Enquiry", "Vehicles", ["products", "customers", "quotes", "marketing"], "Listings, test-drive enquiries and buyers.")],
    [/parts|tyre|batter/i, p("Parts & Accessories", "Order", "Customer", "Order", "Parts", ["products", "orders", "inventory", "marketing"], "Parts catalogue, stock and orders.")],
  ],
  "Agriculture": [
    [/service|consult/i, p("Agri Services", "Engagement", "Client", "Engagement", "Services", ["services", "bookings", "quotes", "customers"], "Consultations and field services.")],
    [/equipment|machinery/i, p("Farm Equipment", "Order", "Customer", "Order", "Equipment", ["products", "quotes", "orders", "customers"], "Equipment catalogue with quotes and orders.")],
    [/crop|produce|livestock|poultry|fish|processing|input|suppl/i, p("Farm Sales", "Order", "Customer", "Order", "Produce & Products", ["products", "orders", "inventory", "delivery"], "Harvest stock, orders and delivery.")],
  ],
  "Electronics": [
    [/repair|servicing/i, p("Repair Workshop", "Repair Job", "Customer", "Repair Job", "Repair Services", ["bookings", "quotes", "customers", "invoices"], "Repair jobs from drop-off to pickup.")],
    [/solar|power/i, p("Solar & Power", "Quote", "Customer", "Quote", "Systems", ["quotes", "products", "orders", "customers"], "Size, quote and sell power systems.")],
  ],
  "Church": [
    [/charity/i, p("Charity Operations", "Donation", "Supporter", "Donation", "Programs", ["payments", "services", "customers", "marketing"], "Donations, programs and supporters.")],
    [/book|media/i, p("Christian Books & Media", "Order", "Customer", "Order", "Resources", ["products", "orders", "inventory", "marketing"], "Resources shop with stock and orders.")],
    [/fellowship|youth/i, p("Fellowship Operations", "Event", "Member", "Event", "Meetings & Events", ["services", "customers", "marketing", "gallery"], "Meetings, events and members.")],
    [/ministry|outreach/i, p("Ministry & Outreach", "Event", "Partner", "Event", "Programmes", ["services", "payments", "customers", "marketing"], "Programmes, partners and support.")],
  ],
};

export function getSpecialtyProfile(category: string | null | undefined, subcategory: string | null | undefined): SpecialtyProfile | null {
  const rules = category ? RULES[category] : undefined;
  const name = (subcategory ?? "").trim();
  if (!rules || !name) return null;
  for (const [re, profile] of rules) if (re.test(name)) return profile;
  return null;
}
