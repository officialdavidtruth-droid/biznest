import type { BuilderConfig, BuilderSection, BuilderSectionType } from "@/lib/builder-config";

export type BusinessMode = "commerce" | "service" | "hybrid";

export type BusinessExperience = {
  mode: BusinessMode;
  label: string;
  description: string;
  primaryAction: string;
  journey: string[];
  preferredSections: BuilderSectionType[];
};

const COMMERCE = ["Fashion", "Electronics", "Food & Groceries", "Home & Furniture", "Agriculture", "Real Estate"];
const SERVICE = ["Restaurant", "Hotel & Lodging", "Beauty", "Health", "Health & Fitness", "Professional Services", "Photography", "Software Development", "Event Planning", "Logistics"];

export function getBusinessExperience(category?: string | null): BusinessExperience {
  const c = category ?? "Other";
  if (SERVICE.includes(c)) {
    const hotel = c === "Hotel & Lodging";
    const restaurant = c === "Restaurant";
    const portfolio = ["Photography", "Event Planning", "Professional Services", "Software Development"].includes(c);
    return {
      mode: "service",
      label: "Service business",
      description: hotel ? "Guide visitors from discovery to availability and booking." : restaurant ? "Turn discovery into menu orders, pickup or delivery." : portfolio ? "Turn proof of work into qualified enquiries and bookings." : "Guide visitors from service discovery to booking or enquiry.",
      primaryAction: hotel ? "Book a stay" : restaurant ? "Order now" : "Book / enquire",
      journey: hotel ? ["Discover", "Explore rooms", "Check availability", "Book", "Confirmation"] : ["Discover", "Explore service", "Choose package", "Book / enquire", "Confirmation"],
      preferredSections: hotel ? ["hero", "gallery", "categories", "catalog", "amenities", "availability", "map", "testimonials", "contact"] : restaurant ? ["hero", "categories", "catalog", "gallery", "features", "map", "testimonials", "contact"] : portfolio ? ["hero", "gallery", "packages", "about", "testimonials", "contact"] : ["hero", "catalog", "packages", "features", "testimonials", "map", "contact"],
    };
  }
  if (["Automotive", "Other"].includes(c)) {
    return {
      mode: "hybrid",
      label: "Products + services",
      description: "Support both selling and booking without forcing the business into one funnel.",
      primaryAction: "Explore",
      journey: ["Discover", "Browse", "Product / service", "Cart / booking", "Checkout"],
      preferredSections: ["hero", "categories", "catalog", "features", "about", "testimonials", "contact"],
    };
  }
  return {
    mode: "commerce",
    label: "E-commerce business",
    description: "Optimize the storefront around discovery, product comparison, cart and checkout.",
    primaryAction: "Shop now",
    journey: ["Discover", "Browse", "Product", "Cart", "Checkout", "Order tracking"],
    preferredSections: ["hero", "categories", "catalog", "deal", "features", "testimonials", "newsletter", "contact"],
  };
}

export function buildIndustryHomepage(category: string | null | undefined, storeName: string, description?: string | null, heroImage?: string | null): BuilderConfig {
  const experience = getBusinessExperience(category);
  const section = (id: string, type: BuilderSectionType, settings: BuilderSection["settings"] = {}): BuilderSection => ({ id, type, visible: true, settings });
  const common = {
    eyebrow: experience.label,
    heading: storeName,
    body: description || experience.description,
    ctaLabel: experience.primaryAction,
    ctaHref: experience.mode === "commerce" ? "#catalog" : "#catalog",
    image: heroImage || undefined,
    padding: "spacious" as const,
  };

  const sections = experience.preferredSections.map((type, index) => {
    if (type === "hero") return section("hero", type, common);
    if (type === "catalog") return section("catalog", type, { eyebrow: experience.mode === "commerce" ? "Featured" : "Services", heading: experience.mode === "commerce" ? "Shop our collection" : "Explore what we offer", body: experience.mode === "commerce" ? "Browse popular products and new arrivals." : "Choose the service, room, package or experience that fits you.", columns: 4, padding: "spacious" });
    if (type === "categories") return section("categories", type, { eyebrow: "Explore", heading: experience.mode === "commerce" ? "Shop by category" : "Explore our offerings", columns: 4, padding: "normal" });
    if (type === "deal") return section("deal", type, { eyebrow: "Special offer", heading: experience.mode === "commerce" ? "Good things are waiting" : "Book with confidence", body: "Add your current promotion, launch offer or seasonal message here.", ctaLabel: experience.primaryAction, ctaHref: "#catalog", padding: "normal" });
    if (type === "features") return section("features", type, { eyebrow: "Why us", heading: experience.mode === "commerce" ? "A better way to buy" : "Why customers choose us", columns: 4, padding: "spacious" });
    if (type === "gallery") return section("gallery", type, { eyebrow: "See more", heading: "A closer look", columns: 4, padding: "spacious" });
    if (type === "packages") return section("packages", type, { eyebrow: "Options", heading: "Packages that fit", columns: 3, padding: "spacious" });
    if (type === "amenities") return section("amenities", type, { eyebrow: "Included", heading: "Everything you need", columns: 4, padding: "normal" });
    if (type === "availability") return section("availability", type, { eyebrow: "Availability", heading: experience.primaryAction, padding: "normal" });
    if (type === "map") return section("map", type, { eyebrow: "Find us", heading: "Visit or contact us", padding: "normal" });
    if (type === "about") return section("about", type, { eyebrow: "Our story", heading: "Built around what matters", body: description || "Tell customers what makes your business different.", padding: "spacious" });
    if (type === "testimonials") return section("testimonials", type, { eyebrow: "Customer love", heading: "What customers say", columns: 3, padding: "spacious" });
    if (type === "newsletter") return section("newsletter", type, { eyebrow: "Stay in the loop", heading: "Get updates from us", padding: "normal" });
    return section(`section-${index}`, type, { padding: "normal" });
  });

  return {
    version: 1,
    design: {
      primary: experience.mode === "service" ? "#172554" : "#123524",
      accent: experience.mode === "service" ? "#2563eb" : "#3aab61",
      background: "#ffffff",
      surface: "#f7f8f6",
      text: "#16211c",
      muted: "#67766d",
      font: "Inter",
      headingFont: "Plus Jakarta Sans",
      radius: 16,
      containerWidth: "standard",
      buttonStyle: experience.mode === "service" ? "pill" : "solid",
    },
    sections,
  };
}
