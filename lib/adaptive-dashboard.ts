import type { LucideIcon } from "lucide-react";
import {
  Activity, BarChart3, BedDouble, BriefcaseBusiness, CalendarDays, Camera, Car, ClipboardList,
  CreditCard, FileSignature, Image, LayoutDashboard, Megaphone, Package, Receipt, Settings,
  ShoppingBag, Sparkles, Star, Truck, Users, Utensils, Wrench, Boxes, Building2, ChefHat,
} from "lucide-react";
import { getBusinessTypeConfig, type Capability } from "@/lib/capabilities";

export type DashboardModule = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  capability?: Capability;
};

export type DashboardKpi = {
  id: string;
  label: string;
  source: "revenue" | "orders" | "visitors" | "conversion" | "bestProduct" | "returning" | "products" | "services" | "bookings" | "rooms" | "customers" | "avgOrderValue";
  format?: "money" | "number" | "percent" | "text";
};

export type DashboardWidget = {
  id: string;
  title: string;
  description: string;
  href?: string;
  type: "activity" | "setup" | "operations" | "performance";
};

export type AdaptiveDashboardConfig = {
  businessType: string;
  subcategory?: string | null;
  label: string;
  tagline: string;
  primaryEntity: string;
  terminology: { customer: string; transaction: string; catalog: string; catalogSingular: string };
  kpis: DashboardKpi[];
  quickActions: DashboardModule[];
  modules: DashboardModule[];
  widgets: DashboardWidget[];
};

const core = {
  dashboard: { id: "dashboard", label: "Dashboard", href: "", icon: LayoutDashboard },
  customers: { id: "customers", label: "Customers", href: "/customers", icon: Users },
  clients: { id: "clients", label: "Clients", href: "/customers", icon: Users },
  products: { id: "products", label: "Products", href: "/products", icon: Package },
  services: { id: "services", label: "Services", href: "/services", icon: Wrench },
  orders: { id: "orders", label: "Orders", href: "/orders", icon: ShoppingBag },
  pos: { id: "pos", label: "Point of Sale", href: "/pos", icon: Receipt },
  bookings: { id: "bookings", label: "Bookings", href: "/bookings", icon: ClipboardList },
  calendar: { id: "calendar", label: "Calendar", href: "/calendar", icon: CalendarDays },
  inventory: { id: "inventory", label: "Inventory", href: "/inventory", icon: Boxes },
  invoices: { id: "invoices", label: "Invoices", href: "/invoices", icon: Receipt },
  quotes: { id: "quotes", label: "Quotes", href: "/quotes", icon: FileSignature },
  payments: { id: "payments", label: "Payments", href: "/payments", icon: CreditCard },
  marketing: { id: "marketing", label: "Marketing", href: "/marketing", icon: Megaphone },
  reviews: { id: "reviews", label: "Reviews", href: "/reviews", icon: Star },
  analytics: { id: "analytics", label: "Analytics", href: "/analytics", icon: BarChart3 },
  projects: { id: "projects", label: "Projects", href: "/projects", icon: BriefcaseBusiness },
  gallery: { id: "gallery", label: "Gallery", href: "/gallery", icon: Image },
  delivery: { id: "delivery", label: "Delivery", href: "/delivery", icon: Truck },
  settings: { id: "settings", label: "Settings", href: "/settings", icon: Settings },
  pms: { id: "pms", label: "BizNest PMS", href: "/pms", icon: BedDouble },
};

const commerceKpis: DashboardKpi[] = [
  { id: "revenue", label: "Revenue", source: "revenue", format: "money" },
  { id: "orders", label: "Orders", source: "orders", format: "number" },
  { id: "visitors", label: "Visitors", source: "visitors", format: "number" },
  { id: "conversion", label: "Conversion", source: "conversion", format: "percent" },
];
const serviceKpis: DashboardKpi[] = [
  { id: "revenue", label: "Revenue", source: "revenue", format: "money" },
  { id: "bookings", label: "Bookings", source: "bookings", format: "number" },
  { id: "clients", label: "Clients", source: "customers", format: "number" },
  { id: "visitors", label: "Visitors", source: "visitors", format: "number" },
];

function clean(items: DashboardModule[]) {
  return items.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
}

type TerminologyOverride = { customer: string; transaction: string; catalog: string; catalogSingular?: string };

const CATEGORY_OVERRIDES: Record<string, Omit<Partial<AdaptiveDashboardConfig>, "terminology"> & { terminology?: TerminologyOverride }> = {
  Restaurant: { label: "Restaurant Operations", primaryEntity: "Order", terminology: { customer: "Guest", transaction: "Order", catalog: "Menu" }, kpis: [{ id: "bookings", label: "Total Reservations", source: "bookings", format: "number" }, { id: "orders", label: "Total Orders", source: "orders", format: "number" }, { id: "revenue", label: "Total Revenue", source: "revenue", format: "money" }, { id: "customers", label: "New Customers", source: "customers", format: "number" }, { id: "avgOrderValue", label: "Average Order Value", source: "avgOrderValue", format: "money" }], quickActions: [core.bookings, core.pos, core.products, core.inventory, core.marketing, core.analytics], widgets: [{ id: "menu", title: "Menu operations", description: "Manage menu items, categories and availability from one place.", href: "/products", type: "operations" }] },
  "Hotel & Lodging": { label: "Hotel Operations", primaryEntity: "Reservation", terminology: { customer: "Guest", transaction: "Reservation", catalog: "Rooms" }, quickActions: [core.pms, core.bookings, core.calendar, core.clients], widgets: [{ id: "pms", title: "Property operations", description: "Reservations, rooms, front desk, housekeeping and guest operations live in your PMS.", href: "/pms", type: "operations" }] },
  Photography: { label: "Photography Studio", primaryEntity: "Booking", terminology: { customer: "Client", transaction: "Booking", catalog: "Packages" }, quickActions: [core.bookings, core.calendar, core.services, core.gallery], widgets: [{ id: "shoots", title: "Shoot pipeline", description: "Keep upcoming shoots, client work and galleries moving from booking to delivery.", href: "/calendar", type: "operations" }] },
  Beauty: { label: "Beauty Studio", primaryEntity: "Booking", terminology: { customer: "Client", transaction: "Appointment", catalog: "Services" }, quickActions: [core.bookings, core.calendar, core.services, core.clients] },
  Salon: { label: "Salon Operations", primaryEntity: "Booking", terminology: { customer: "Client", transaction: "Appointment", catalog: "Services" }, quickActions: [core.bookings, core.calendar, core.services, core.clients] },
  "Real Estate": { label: "Property Operations", primaryEntity: "Listing", terminology: { customer: "Client", transaction: "Enquiry", catalog: "Properties" }, quickActions: [core.products, core.clients, core.quotes, core.analytics], widgets: [{ id: "listings", title: "Listing performance", description: "Keep property inventory, client enquiries and listing activity visible.", href: "/products", type: "operations" }] },
  Construction: { label: "Construction Operations", primaryEntity: "Project", terminology: { customer: "Client", transaction: "Project", catalog: "Services" }, quickActions: [core.projects, core.quotes, core.clients, core.invoices] },
  Logistics: { label: "Logistics Operations", primaryEntity: "Delivery", terminology: { customer: "Client", transaction: "Delivery", catalog: "Services" }, quickActions: [core.orders, core.delivery, core.calendar, core.clients] },
  Automotive: { label: "Automotive Operations", primaryEntity: "Job", terminology: { customer: "Customer", transaction: "Job", catalog: "Parts & Services" }, quickActions: [core.orders, core.services, core.inventory, core.calendar] },
  "Event Planning": { label: "Event Operations", primaryEntity: "Event", terminology: { customer: "Client", transaction: "Event", catalog: "Packages" }, quickActions: [core.bookings, core.calendar, core.projects, core.quotes] },
  Cleaning: { label: "Cleaning Operations", primaryEntity: "Job", terminology: { customer: "Client", transaction: "Job", catalog: "Services" }, quickActions: [core.bookings, core.calendar, core.services, core.clients] },
  "Health & Fitness": { label: "Fitness Operations", primaryEntity: "Booking", terminology: { customer: "Member", transaction: "Booking", catalog: "Programs & Services" }, quickActions: [core.bookings, core.calendar, core.services, core.clients] },
  Health: { label: "Health Services", primaryEntity: "Appointment", terminology: { customer: "Patient", transaction: "Appointment", catalog: "Services" }, quickActions: [core.bookings, core.calendar, core.services, core.clients] },
  "Food & Groceries": { label: "Grocery Operations", primaryEntity: "Order", terminology: { customer: "Customer", transaction: "Order", catalog: "Products" }, quickActions: [core.products, core.orders, core.inventory, core.delivery] },
  "Home & Furniture": { label: "Furniture Operations", primaryEntity: "Order", terminology: { customer: "Customer", transaction: "Order", catalog: "Products" }, quickActions: [core.products, core.orders, core.inventory, core.delivery] },
  Agriculture: { label: "Agriculture Operations", primaryEntity: "Order", terminology: { customer: "Customer", transaction: "Order", catalog: "Products" }, quickActions: [core.products, core.orders, core.inventory, core.delivery] },
  Electronics: { label: "Electronics Operations", primaryEntity: "Order", terminology: { customer: "Customer", transaction: "Order", catalog: "Products" }, quickActions: [core.products, core.orders, core.inventory, core.customers] },
  Fashion: { label: "Fashion Operations", primaryEntity: "Order", terminology: { customer: "Customer", transaction: "Order", catalog: "Collections" }, quickActions: [core.products, core.orders, core.inventory, core.marketing] },
};

function subcategoryProfile(category: string, subcategory?: string | null): Omit<Partial<AdaptiveDashboardConfig>, "terminology"> & { terminology?: TerminologyOverride } {
  const s = (subcategory ?? "").toLowerCase();
  if (category === "Professional Services") {
    if (/graphic|logo|branding|design/.test(s)) return { label: subcategory || "Creative Services", primaryEntity: "Project", terminology: { customer: "Client", transaction: "Project", catalog: "Services" }, quickActions: [core.projects, core.quotes, core.services, core.gallery], widgets: [{ id: "project-pipeline", title: "Project pipeline", description: "Track active creative work, approvals and upcoming deadlines.", href: "/projects", type: "operations" }] };
    if (/account/.test(s)) return { label: "Accounting Services", primaryEntity: "Client", terminology: { customer: "Client", transaction: "Invoice", catalog: "Services" }, quickActions: [core.invoices, core.clients, core.quotes, core.payments] };
    if (/legal|law/.test(s)) return { label: "Legal Services", primaryEntity: "Matter", terminology: { customer: "Client", transaction: "Matter", catalog: "Services" }, quickActions: [core.clients, core.projects, core.calendar, core.invoices] };
    if (/architect|engineer|construction/.test(s)) return { label: "Technical Services", primaryEntity: "Project", terminology: { customer: "Client", transaction: "Project", catalog: "Services" }, quickActions: [core.projects, core.quotes, core.clients, core.invoices] };
    if (/marketing|social/.test(s)) return { label: "Marketing Services", primaryEntity: "Campaign", terminology: { customer: "Client", transaction: "Campaign", catalog: "Services" }, quickActions: [core.projects, core.marketing, core.analytics, core.clients] };
  }
  return {};
}

export function getAdaptiveDashboardConfig(category?: string | null, subcategory?: string | null, model?: { sellsProducts?: boolean | null; offersServices?: boolean | null }): AdaptiveDashboardConfig {
  const config = getBusinessTypeConfig(category);
  const caps = new Set(config.capabilities);
  if (model?.sellsProducts) caps.add("products");
  if (model?.offersServices) { caps.add("services"); caps.add("bookings"); }
  const product = caps.has("products");
  const service = caps.has("services") || caps.has("bookings");
  let modules: DashboardModule[] = [core.customers, core.payments, core.invoices, core.analytics, core.settings];
  if (product) modules = modules.concat([core.orders, core.products]);
  if (service) modules = modules.concat([core.services, core.bookings, core.calendar]);
  if (caps.has("inventory")) modules.push(core.inventory);
  if (caps.has("delivery")) modules.push(core.delivery);
  if (caps.has("gallery") || caps.has("portfolio")) modules.push(core.gallery);
  if (caps.has("reviews")) modules.push(core.reviews);
  if (caps.has("packages")) modules.push(core.services);
  if (caps.has("pms")) modules.push(core.pms);
  const profile = { ...(CATEGORY_OVERRIDES[configLabel(category)] ?? {}), ...subcategoryProfile(configLabel(category), subcategory) };
  const baseKpis: DashboardKpi[] = configLabel(category) === "Hotel & Lodging" ? [
    { id: "revenue", label: "Revenue", source: "revenue", format: "money" },
    { id: "bookings", label: "Reservations", source: "bookings", format: "number" },
    { id: "clients", label: "Guests", source: "customers", format: "number" },
    { id: "visitors", label: "Visitors", source: "visitors", format: "number" },
  ] : service && !product ? serviceKpis : commerceKpis;
  const defaultActions = service && !product ? [core.services, core.bookings, core.calendar, core.clients] : [product ? core.products : core.services, product ? core.orders : core.bookings, core.clients, core.analytics];
  const widgets: DashboardWidget[] = [
    { id: "performance", title: "Business performance", description: "See the signals that matter most for this business type.", href: "/analytics", type: "performance" },
    { id: "next", title: "What needs attention", description: "BizNest surfaces the next useful actions instead of showing every feature at once.", type: "activity" },
  ];
  if (caps.has("inventory")) widgets.push({ id: "stock", title: "Stock health", description: "Keep products available and identify inventory that needs attention.", href: "/inventory", type: "operations" });
  if (caps.has("bookings")) widgets.push({ id: "schedule", title: "Upcoming schedule", description: "Bookings and appointments are the operational heartbeat of this business.", href: "/calendar", type: "operations" });
  if (caps.has("pms")) widgets.push({ id: "pms", title: "Hotel operations", description: "Open the dedicated PMS for reservations, rooms, front desk and housekeeping.", href: "/pms", type: "operations" });
  if (caps.has("delivery")) widgets.push({ id: "delivery", title: "Delivery operations", description: "Manage delivery areas and fulfillment without cluttering the main dashboard.", href: "/delivery", type: "operations" });
  const terminology = profile.terminology ?? { customer: service && !product ? "Client" : "Customer", transaction: product ? "Order" : "Booking", catalog: product ? "Products" : "Services" };
  return {
    businessType: configLabel(category), subcategory, label: profile.label ?? config.tagline,
    tagline: config.tagline, primaryEntity: profile.primaryEntity ?? (product ? "Order" : "Booking"),
    terminology: { ...terminology, catalogSingular: terminology.catalogSingular ?? singularize(terminology.catalog) },
    kpis: profile.kpis ?? baseKpis, quickActions: clean(profile.quickActions ?? defaultActions), modules: clean(modules), widgets: profile.widgets ? [...widgets, ...profile.widgets] : widgets,
  };
}

function configLabel(category?: string | null) {
  return category || "Other";
}

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
            
