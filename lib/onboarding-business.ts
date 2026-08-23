import {
  Building2,
  Camera,
  ChefHat,
  Heart,
  Hotel,
  Laptop,
  Paintbrush,
  Scissors,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Wrench,
  Briefcase,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type OnboardingField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "number" | "textarea";
  helper?: string;
};

export type BusinessOnboardingPlan = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  checklist: string[];
  fields: OnboardingField[];
  recommendations: string[];
};

const PRODUCT_PLAN: BusinessOnboardingPlan = {
  icon: ShoppingBag,
  eyebrow: "Commerce setup",
  title: "Tell us what you sell",
  description: "We'll use this to shape your catalog, delivery options and the first version of your storefront.",
  checklist: ["Product catalog", "Inventory tracking", "Order checkout"],
  fields: [
    { key: "productFocus", label: "What do you mainly sell?", placeholder: "e.g. sneakers, phones, home decor" },
    { key: "deliveryArea", label: "Where do you deliver?", placeholder: "e.g. Lagos, Abuja and nearby cities" },
  ],
  recommendations: ["Add your best sellers first", "Upload clear product photos", "Set delivery or pickup rules"],
};

const SERVICE_PLAN: BusinessOnboardingPlan = {
  icon: Wrench,
  eyebrow: "Service setup",
  title: "Tell us how customers book you",
  description: "We'll prepare the storefront around services, availability, packages and customer enquiries.",
  checklist: ["Service catalog", "Booking flow", "Customer enquiries"],
  fields: [
    { key: "serviceFocus", label: "What services do you offer?", placeholder: "e.g. home cleaning, hair styling, photography", type: "textarea" },
    { key: "serviceArea", label: "Where do you serve customers?", placeholder: "e.g. Lekki, Ikeja and Victoria Island" },
  ],
  recommendations: ["Create 3–5 core services", "Add realistic durations and prices", "Set your availability before publishing"],
};

const PLANS: Record<string, Partial<BusinessOnboardingPlan>> = {
  Fashion: {
    icon: ShoppingBag,
    eyebrow: "Fashion setup",
    title: "Build your fashion storefront",
    fields: [
      { key: "productFocus", label: "What kind of fashion do you sell?", placeholder: "e.g. womenswear, menswear, streetwear" },
      { key: "sizeRange", label: "Typical size range", placeholder: "e.g. XS–XXL, UK 6–14" },
    ],
    recommendations: ["Create collections", "Add size/color variants", "Highlight new arrivals"],
  },
  Electronics: {
    icon: Laptop,
    eyebrow: "Electronics setup",
    title: "Build a trusted electronics store",
    fields: [
      { key: "productFocus", label: "What do you specialise in?", placeholder: "e.g. phones, laptops, accessories" },
      { key: "warranty", label: "Warranty / after-sales policy", placeholder: "e.g. 12-month warranty on selected devices", type: "textarea" },
    ],
    recommendations: ["Add model/specification details", "Show warranty information", "Keep stock levels accurate"],
  },
  "Food & Groceries": {
    icon: ShoppingBag,
    eyebrow: "Grocery setup",
    title: "Make everyday shopping fast",
    fields: [
      { key: "productFocus", label: "What do you stock?", placeholder: "e.g. fresh food, drinks, household essentials" },
      { key: "deliveryArea", label: "Delivery area", placeholder: "e.g. Yaba, Surulere and nearby areas" },
    ],
    recommendations: ["Group products by aisle/category", "Set delivery zones", "Feature weekly deals"],
  },
  Restaurant: {
    icon: ChefHat,
    eyebrow: "Restaurant setup",
    title: "Set up your restaurant experience",
    fields: [
      { key: "cuisine", label: "Cuisine / food style", placeholder: "e.g. Nigerian, continental, pizza" },
      { key: "orderingModes", label: "How can customers order?", placeholder: "e.g. Delivery, pickup, dine-in" },
      { key: "openingHours", label: "Opening hours", placeholder: "e.g. Mon–Sun, 10:00am–10:00pm" },
    ],
    recommendations: ["Organise the menu into categories", "Add signature dishes", "Show opening hours prominently"],
  },
  "Hotel & Lodging": {
    icon: Hotel,
    eyebrow: "Hotel setup",
    title: "Create a stay guests can book",
    fields: [
      { key: "roomTypes", label: "Room types", placeholder: "e.g. Standard, Deluxe, Executive Suite" },
      { key: "checkInOut", label: "Check-in / check-out", placeholder: "e.g. 2:00pm / 12:00pm" },
      { key: "amenities", label: "Top amenities", placeholder: "e.g. Wi-Fi, pool, breakfast, parking" },
    ],
    recommendations: ["Add every room type", "Show availability clearly", "Highlight amenities and location"],
  },
  Beauty: {
    icon: Sparkles,
    eyebrow: "Beauty setup",
    title: "Turn your services into bookings",
    fields: [
      { key: "serviceFocus", label: "Main beauty services", placeholder: "e.g. facials, nails, makeup, skincare" },
      { key: "teamSize", label: "How many professionals serve customers?", placeholder: "e.g. 4", type: "number" },
      { key: "appointmentLength", label: "Typical appointment length", placeholder: "e.g. 60 minutes" },
    ],
    recommendations: ["Add service duration and pricing", "Introduce your team", "Make booking availability obvious"],
  },
  Salon: {
    icon: Scissors,
    eyebrow: "Salon setup",
    title: "Build a salon customers can book",
    fields: [
      { key: "serviceFocus", label: "Main salon services", placeholder: "e.g. braids, cuts, colouring, nails" },
      { key: "teamSize", label: "Number of stylists / professionals", placeholder: "e.g. 5", type: "number" },
      { key: "appointmentLength", label: "Typical appointment length", placeholder: "e.g. 90 minutes" },
    ],
    recommendations: ["Add your service menu", "Show stylist availability", "Feature your best work"],
  },
  Photography: {
    icon: Camera,
    eyebrow: "Photography setup",
    title: "Turn your portfolio into bookings",
    fields: [
      { key: "specialties", label: "Photography specialties", placeholder: "e.g. weddings, portraits, products" },
      { key: "packages", label: "Main packages", placeholder: "e.g. Mini, Standard, Premium" },
      { key: "turnaround", label: "Typical delivery time", placeholder: "e.g. 7–14 days" },
    ],
    recommendations: ["Lead with your strongest work", "Create clear packages", "Show testimonials and availability"],
  },
  "Professional Services": {
    icon: Briefcase,
    eyebrow: "Professional services setup",
    title: "Turn expertise into enquiries",
    fields: [
      { key: "serviceFocus", label: "Your core services", placeholder: "e.g. consulting, legal, accounting, design", type: "textarea" },
      { key: "clientType", label: "Who do you serve?", placeholder: "e.g. startups, SMEs, individuals" },
    ],
    recommendations: ["Explain your outcomes", "Package common services", "Add proof through testimonials"],
  },
  Agency: {
    icon: Paintbrush,
    eyebrow: "Agency setup",
    title: "Turn your agency into a conversion machine",
    fields: [
      { key: "serviceFocus", label: "Agency capabilities", placeholder: "e.g. branding, social media, web development", type: "textarea" },
      { key: "clientType", label: "Ideal clients", placeholder: "e.g. startups, brands, enterprises" },
      { key: "teamSize", label: "Team size", placeholder: "e.g. 8", type: "number" },
    ],
    recommendations: ["Show case studies", "Explain your process", "Make consultation the primary CTA"],
  },
  Cleaning: {
    icon: Sparkles,
    eyebrow: "Cleaning setup",
    title: "Make booking a cleaner simple",
    fields: [
      { key: "serviceFocus", label: "Cleaning services", placeholder: "e.g. home, office, deep cleaning" },
      { key: "serviceArea", label: "Service areas", placeholder: "e.g. Ikeja, Lekki, Yaba" },
      { key: "propertyTypes", label: "Property types", placeholder: "e.g. homes, offices, shops" },
    ],
    recommendations: ["Create simple service packages", "Define coverage areas", "Offer recurring cleaning where possible"],
  },
  Construction: {
    icon: Building2,
    eyebrow: "Construction setup",
    title: "Turn projects into qualified leads",
    fields: [
      { key: "projectTypes", label: "Project types", placeholder: "e.g. residential, commercial, renovation" },
      { key: "serviceArea", label: "Service areas", placeholder: "e.g. Lagos and Ogun" },
      { key: "quoteProcess", label: "How do you quote projects?", placeholder: "e.g. Site inspection before quotation", type: "textarea" },
    ],
    recommendations: ["Show completed projects", "Explain your process", "Use a quote request CTA"],
  },
  "Home & Furniture": {
    icon: Store,
    eyebrow: "Furniture setup",
    title: "Build an inspiring home store",
    fields: [
      { key: "productFocus", label: "What furniture do you sell?", placeholder: "e.g. sofas, beds, dining, office" },
      { key: "deliveryArea", label: "Delivery area", placeholder: "e.g. Lagos mainland and island" },
    ],
    recommendations: ["Organise by room", "Use large lifestyle images", "Explain delivery and assembly"],
  },
  "Software Development": {
    icon: Laptop,
    eyebrow: "Software agency setup",
    title: "Turn software expertise into projects",
    fields: [
      { key: "serviceFocus", label: "Development capabilities", placeholder: "e.g. web apps, mobile apps, APIs", type: "textarea" },
      { key: "clientType", label: "Ideal client", placeholder: "e.g. startups, SMEs, enterprise" },
    ],
    recommendations: ["Show case studies", "Package common projects", "Add a consultation CTA"],
  },
  "Event Planning": {
    icon: Heart,
    eyebrow: "Events setup",
    title: "Make your events business easy to book",
    fields: [
      { key: "eventTypes", label: "Events you handle", placeholder: "e.g. weddings, birthdays, corporate events" },
      { key: "packages", label: "Main packages", placeholder: "e.g. Coordination, Full Planning, Premium" },
    ],
    recommendations: ["Show your best events", "Create clear packages", "Collect booking details early"],
  },
  Logistics: {
    icon: Truck,
    eyebrow: "Logistics setup",
    title: "Make delivery requests straightforward",
    fields: [
      { key: "serviceFocus", label: "Logistics services", placeholder: "e.g. same-day, interstate, business delivery" },
      { key: "serviceArea", label: "Coverage area", placeholder: "e.g. Lagos, Abuja and interstate" },
    ],
    recommendations: ["Define service zones", "Explain delivery timelines", "Make quote requests easy"],
  },
};

export function getBusinessOnboardingPlan(category: string, sellsProducts: boolean, offersServices: boolean): BusinessOnboardingPlan {
  const base = sellsProducts && offersServices ? PRODUCT_PLAN : sellsProducts ? PRODUCT_PLAN : SERVICE_PLAN;
  const override = PLANS[category];
  return {
    ...base,
    ...override,
    icon: override?.icon ?? base.icon,
    fields: override?.fields ?? base.fields,
    checklist: override?.checklist ?? base.checklist,
    recommendations: override?.recommendations ?? base.recommendations,
  };
}
