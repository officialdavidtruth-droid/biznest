import type { BuilderConfig, BuilderSection, BuilderSectionType } from "@/lib/builder-config";
import type { TemplateTheme } from "@/lib/template-themes";

function radiusPx(value: string | undefined) {
  if (!value) return 16;
  const m = value.match(/([0-9.]+)/);
  return Math.max(0, Math.min(48, Math.round(Number(m?.[1] ?? 16) * (value.includes("rem") ? 16 : 1))));
}

function sectionFor(theme: TemplateTheme, type: string, index: number, storeName: string, description?: string | null, heroImage?: string | null): BuilderSection | null {
  const supported = new Set(["hero","catalog","about","stats","features","categories","testimonials","newsletter","contact","gallery","map"]);
  if (!supported.has(type)) return null;
  const id = `${type}-${index}`;
  const base = { id, type: type as BuilderSectionType, visible: true, settings: {} as BuilderSection["settings"] };
  if (type === "hero") base.settings = { eyebrow: theme.eyebrow, heading: theme.headline || storeName, body: theme.sub || description || undefined, ctaLabel: theme.cta, ctaHref: "#catalog", image: heroImage || undefined, align: theme.heroStyle === "centered" ? "center" : "left", padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "catalog") base.settings = { eyebrow: theme.catalogLabel, heading: theme.catalogLabel, columns: theme.layout === "list" ? 3 : 4, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "about") base.settings = { eyebrow: "Our story", heading: "Built around what matters", body: description || theme.sub, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "stats") base.settings = { padding: "normal" };
  else if (type === "features") base.settings = { eyebrow: "Why choose us", heading: "Designed around your needs", columns: 3, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "categories") base.settings = { eyebrow: "Explore", heading: "Browse categories", columns: 4, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "testimonials") base.settings = { eyebrow: "Customer love", heading: "What customers say", columns: 3, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "newsletter") base.settings = { eyebrow: "Stay in the loop", heading: "Get updates from us", padding: "normal", background: theme.surfaceDark || theme.ink };
  else if (type === "contact") base.settings = { eyebrow: "Contact", heading: "Let's work together", columns: 2, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "gallery") base.settings = { eyebrow: "Gallery", heading: "A closer look", columns: 4, padding: "spacious" };
  else if (type === "map") base.settings = { eyebrow: "Find us", heading: "Visit us", padding: "normal" };
  return base;
}

export function templateThemeToBuilderConfig(theme: TemplateTheme, storeName: string, description?: string | null, heroImage?: string | null): BuilderConfig {
  const sectionNames = theme.sections.length ? theme.sections : ["hero", "catalog", "about", "testimonials", "contact"];
  const sections = sectionNames.map((type, index) => sectionFor(theme, type, index, storeName, description, heroImage)).filter(Boolean) as BuilderSection[];
  if (!sections.some((s) => s.type === "hero")) sections.unshift(sectionFor(theme, "hero", 0, storeName, description, heroImage)!);
  if (!sections.some((s) => s.type === "catalog")) sections.push(sectionFor(theme, "catalog", sections.length, storeName, description, heroImage)!);
  return {
    version: 1,
    design: {
      primary: theme.surfaceDark || theme.ink,
      accent: theme.accent,
      background: theme.bg,
      surface: theme.card,
      text: theme.ink,
      muted: theme.muted || theme.ink,
      font: theme.font,
      headingFont: theme.headlineFont,
      radius: radiusPx(theme.radius),
      containerWidth: theme.layout === "list" ? "standard" : "wide",
      buttonStyle: theme.radius === "2px" ? "solid" : theme.density === "compact" ? "pill" : "solid",
    },
    sections,
  };
}
