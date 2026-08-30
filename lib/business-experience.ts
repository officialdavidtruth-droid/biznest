import type { BuilderConfig, BuilderSection, BuilderSectionType } from "@/lib/builder-config";

export type BusinessMode = "commerce" | "service" | "hybrid";

export type BusinessModelInput = {
  sellsProducts?: boolean | null;
  offersServices?: boolean | null;
};

export type BusinessExperience = {
  mode: BusinessMode;
  label: string;
  description: string;
  primaryAction: string;
  journey: string[];
  preferredSections: BuilderSectionType[];
  navigation: Array<{ label: string; href: string }>;
  pageSlugs: Array<{ slug: string; title: string }>;
};

const COMMERCE = ["Fashion", "Electronics", "Food & Groceries", "Home & Furniture", "Agriculture", "Real Estate"];
const SERVICE = ["Restaurant", "Hotel & Lodging", "Beauty", "Salon", "Health", "Health & Fitness", "Professional Services", "Photography", "Software Development", "Event Planning", "Logistics", "Church", "Cleaning", "Construction", "Agency"];

export function resolveBusinessMode(category?: string | null, model?: BusinessModelInput): BusinessMode {
  if (model?.sellsProducts || model?.offersServices) {
    if (model.sellsProducts && model.offersServices) return "hybrid";
    return model.sellsProducts ? "commerce" : "service";
  }
  const c = category ?? "Other";
  if (SERVICE.includes(c)) return "service";
  if (COMMERCE.includes(c)) return "commerce";
  return "hybrid";
}

export function getBusinessExperience(category?: string | null, model?: BusinessModelInput, subcategory?: string | null): BusinessExperience {
  const c = category ?? "Other";
  const mode = resolveBusinessMode(c, model);
  const hotel = c === "Hotel & Lodging";
  const restaurant = c === "Restaurant";
  const salon = c === "Salon" || c === "Beauty";
  const portfolio = ["Photography", "Event Planning", "Professional Services", "Software Development", "Agency", "Construction"].includes(c);
  const professional = c === "Professional Services";
  const creativePrint = professional && (subcategory ?? "").toLowerCase().includes("graphic design");
  const specializedPortfolio = professional && Boolean(subcategory);

  if (mode === "service") {
    const navigation = hotel
      ? [{ label: "Home", href: "/" }, { label: "Rooms", href: "/services" }, { label: "Amenities", href: "/#amenities" }, { label: "Gallery", href: "/#gallery" }, { label: "About", href: "/about" }, { label: "Contact", href: "/contact" }]
      : restaurant
        ? [{ label: "Home", href: "/" }, { label: "Menu", href: "/services" }, { label: "About", href: "/about" }, { label: "Gallery", href: "/#gallery" }, { label: "Reservations", href: "/services" }, { label: "Contact", href: "/contact" }]
        : salon
          ? [{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: "Stylists", href: "/#team" }, { label: "Gallery", href: "/#gallery" }, { label: "About", href: "/about" }, { label: "Contact", href: "/contact" }]
          : portfolio
            ? [{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: "Portfolio", href: "/#portfolio" }, { label: "About", href: "/about" }, { label: "Testimonials", href: "/#testimonials" }, { label: "Contact", href: "/contact" }]
            : [{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: "About", href: "/about" }, { label: "Gallery", href: "/#gallery" }, { label: "Testimonials", href: "/#testimonials" }, { label: "Contact", href: "/contact" }];

    const finalNavigation = creativePrint
      ? [...navigation.filter((item) => item.label !== "Testimonials"), { label: "Start a Project", href: "/start-project" }]
      : navigation;

    return {
      mode,
      label: "Service business",
      description: hotel ? "A premium business website built around hospitality, availability and direct booking." : salon ? "A sophisticated service website built around specialists, services, packages and effortless booking." : restaurant ? "A business website built around your menu, reservations, pickup or delivery." : creativePrint ? "A creative studio website built around services, portfolio work, project briefs, quotes and production." : specializedPortfolio ? `A specialized ${subcategory} website built around expertise, proof, projects and client enquiries.` : "A professional business website built around your services, expertise, proof and customer enquiries.",
      primaryAction: hotel ? "Book a stay" : restaurant ? "View the menu" : salon ? "Book an appointment" : creativePrint ? "Start a project" : "Book / enquire",
      journey: hotel ? ["Discover", "Explore rooms", "Check availability", "Book", "Confirmation"] : salon ? ["Discover", "Explore services", "Choose a specialist", "Book", "Confirmation"] : creativePrint ? ["Discover", "Choose service", "Request quote", "Approve design", "Production", "Delivery"] : ["Discover", "Explore services", "Choose package", "Book / enquire", "Confirmation"],
      preferredSections: hotel ? ["hero", "gallery", "catalog", "about", "testimonials", "map", "contact"] : salon ? ["hero", "catalog", "gallery", "features", "about", "testimonials", "contact"] : creativePrint ? ["hero", "gallery", "catalog", "about", "testimonials", "contact"] : portfolio ? ["hero", "gallery", "catalog", "about", "testimonials", "contact"] : ["hero", "catalog", "about", "gallery", "features", "testimonials", "contact"],
      navigation: finalNavigation,
      pageSlugs: [
        { slug: "home", title: "Home" },
        { slug: "about", title: "About" },
        { slug: "services", title: "Services" },
        ...(professional ? [{ slug: "portfolio", title: creativePrint ? "Portfolio" : "Case Studies" }, { slug: "start-project", title: creativePrint ? "Start a Project" : "Start a Project" }] : []),
        { slug: "gallery", title: hotel ? "Gallery" : "Portfolio / Gallery" },
        { slug: "testimonials", title: "Testimonials" },
        { slug: "faq", title: "FAQ" },
        { slug: "contact", title: "Contact" },
        { slug: "policies", title: "Policies" },
      ],
    };
  }

  if (mode === "commerce") {
    return {
      mode,
      label: "Product business",
      description: "A polished business website built around product discovery, collections, purchasing and checkout.",
      primaryAction: "Shop now",
      journey: ["Discover", "Browse", "Product", "Cart", "Checkout", "Order tracking"],
      preferredSections: ["hero", "categories", "catalog", "features", "about", "gallery", "testimonials", "newsletter", "contact"],
      navigation: [{ label: "Home", href: "/" }, { label: "Shop", href: "/products" }, { label: "Collections", href: "/#categories" }, { label: "About", href: "/about" }, { label: "Gallery", href: "/#gallery" }, { label: "Contact", href: "/contact" }],
      pageSlugs: [
        { slug: "home", title: "Home" },
        { slug: "about", title: "About" },
        { slug: "products", title: "Products" },
        { slug: "gallery", title: "Gallery" },
        { slug: "testimonials", title: "Testimonials" },
        { slug: "faq", title: "FAQ" },
        { slug: "contact", title: "Contact" },
        { slug: "policies", title: "Policies" },
      ],
    };
  }

  return {
    mode,
    label: "Products + services",
    description: "A complete business website that naturally supports both products and services without forcing either experience to dominate.",
    primaryAction: "Explore",
    journey: ["Discover", "Browse", "Product or service", "Purchase or booking", "Confirmation"],
    preferredSections: ["hero", "categories", "catalog", "features", "about", "gallery", "testimonials", "contact"],
    navigation: [{ label: "Home", href: "/" }, { label: "Products", href: "/products" }, { label: "Services", href: "/services" }, { label: "About", href: "/about" }, { label: "Gallery", href: "/#gallery" }, { label: "Contact", href: "/contact" }],
    pageSlugs: [
      { slug: "home", title: "Home" },
      { slug: "about", title: "About" },
      { slug: "products", title: "Products" },
      { slug: "services", title: "Services" },
      { slug: "gallery", title: "Gallery" },
      { slug: "testimonials", title: "Testimonials" },
      { slug: "faq", title: "FAQ" },
      { slug: "contact", title: "Contact" },
      { slug: "policies", title: "Policies" },
    ],
  };
}

export function buildIndustryHomepage(category: string | null | undefined, storeName: string, description?: string | null, heroImage?: string | null, model?: BusinessModelInput, subcategory?: string | null): BuilderConfig {
  const experience = getBusinessExperience(category, model, subcategory);
  const section = (id: string, type: BuilderSectionType, settings: BuilderSection["settings"] = {}): BuilderSection => ({ id, type, visible: true, settings });
  const common = {
    eyebrow: experience.label,
    heading: storeName,
    body: description || experience.description,
    ctaLabel: experience.primaryAction,
    ctaHref: category === "Professional Services" && (subcategory ?? "").toLowerCase().includes("graphic design") ? "/start-project" : "#catalog",
    image: heroImage || undefined,
    padding: "spacious" as const,
  };
  const sections = experience.preferredSections.map((type, index) => {
    if (type === "hero") return section("hero", type, common);
    if (type === "catalog") return section("catalog", type, { eyebrow: experience.mode === "commerce" ? "Featured" : "Our services", heading: experience.mode === "commerce" ? "Shop our collection" : experience.mode === "service" ? "Services designed around you" : "Products & services", body: experience.mode === "commerce" ? "Browse products, collections and new arrivals." : "Explore the services, packages and experiences this business offers.", columns: 4, padding: "spacious" });
    if (type === "categories") return section("categories", type, { eyebrow: "Explore", heading: experience.mode === "commerce" ? "Shop by category" : "Explore our offerings", columns: 4, padding: "normal" });
    if (type === "features") return section("features", type, { eyebrow: "Why us", heading: experience.mode === "commerce" ? "A better way to buy" : "Why clients choose us", columns: 4, padding: "spacious" });
    if (type === "gallery") return section("gallery", type, { eyebrow: experience.mode === "service" ? "Our work" : "See more", heading: experience.mode === "service" ? "A look at what we do" : "A closer look", columns: 4, padding: "spacious" });
    if (type === "stats") return section("stats", type, { eyebrow: "At a glance", heading: experience.primaryAction, padding: "normal" });
    if (type === "map") return section("map", type, { eyebrow: "Find us", heading: "Visit or contact us", padding: "normal" });
    if (type === "about") return section("about", type, { eyebrow: "About the business", heading: "Built around what matters", body: description || "Tell customers what makes this business different.", padding: "spacious" });
    if (type === "testimonials") return section("testimonials", type, { eyebrow: "Client feedback", heading: "What customers say", columns: 3, padding: "spacious" });
    if (type === "newsletter") return section("newsletter", type, { eyebrow: "Stay in the loop", heading: "Get updates from us", padding: "normal" });
    if (type === "text") return section(`section-${index}`, type, { eyebrow: "More", heading: experience.primaryAction, body: "Add your current promotion, message or business information here.", ctaLabel: experience.primaryAction, ctaHref: "#catalog", padding: "normal" });
    return section(`section-${index}`, type, { padding: "normal" });
  });
  return { version: 1, design: { primary: experience.mode === "service" ? "#172554" : "#123524", accent: experience.mode === "service" ? "#2563eb" : "#3aab61", background: "#ffffff", surface: "#f7f8f6", text: "#16211c", muted: "#67766d", font: "Inter", headingFont: "Plus Jakarta Sans", radius: 16, containerWidth: "standard", buttonStyle: experience.mode === "service" ? "pill" : "solid" }, sections };
}
