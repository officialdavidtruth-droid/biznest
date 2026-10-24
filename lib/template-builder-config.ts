import type { BuilderConfig, BuilderSection, BuilderSectionType } from "@/lib/builder-config";
import type { TemplateTheme } from "@/lib/template-themes";

function radiusPx(value: string | undefined) {
  if (!value) return 16;
  const m = value.match(/([0-9.]+)/);
  return Math.max(0, Math.min(48, Math.round(Number(m?.[1] ?? 16) * (value.includes("rem") ? 16 : 1))));
}

/** Legacy themes without a `muted` token: use ink at ~70% opacity instead of full-strength ink. */
function softenInk(ink: string) {
  return /^#[0-9a-f]{6}$/i.test(ink) ? `${ink}B3` : ink;
}

function sectionFor(theme: TemplateTheme, type: string, index: number, storeName: string, description?: string | null, heroImage?: string | null): BuilderSection | null {
  const supported = new Set(["hero","catalog","about","stats","features","categories","testimonials","newsletter","contact","gallery","map"]);
  if (!supported.has(type)) return null;
  const id = `${type}-${index}`;
  const copy = theme.sectionCopy?.[type as keyof NonNullable<TemplateTheme["sectionCopy"]>];
  const base = { id, type: type as BuilderSectionType, visible: true, settings: {} as BuilderSection["settings"] };
  if (type === "hero") base.settings = { eyebrow: theme.eyebrow, heading: theme.headline || storeName, body: description || theme.sub || undefined, ctaLabel: theme.cta, ctaHref: "#catalog", image: heroImage || undefined, heroStyle: theme.heroStyle, heroVariant: theme.heroVariant, align: theme.heroStyle === "centered" ? "center" : "left", padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "catalog") base.settings = { eyebrow: theme.catalogLabel, heading: theme.catalogLabel, columns: theme.layout === "list" ? 3 : 4, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "about") base.settings = { eyebrow: copy?.eyebrow ?? "Our story", heading: copy?.heading ?? "Built around what matters", body: description || theme.sub, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "stats") base.settings = { padding: "normal" };
  else if (type === "features") base.settings = { eyebrow: copy?.eyebrow ?? "Why choose us", heading: copy?.heading ?? "Designed around your needs", columns: 3, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "categories") base.settings = { eyebrow: copy?.eyebrow ?? "Explore", heading: copy?.heading ?? "Browse categories", columns: 4, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "testimonials") base.settings = { eyebrow: copy?.eyebrow ?? "Customer love", heading: copy?.heading ?? "What customers say", columns: 3, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "newsletter") base.settings = { eyebrow: copy?.eyebrow ?? "Stay in the loop", heading: copy?.heading ?? "Get updates from us", padding: "normal", background: theme.surfaceDark || theme.ink };
  else if (type === "contact") base.settings = { eyebrow: copy?.eyebrow ?? "Contact", heading: copy?.heading ?? "Let's work together", columns: 2, padding: theme.density === "compact" ? "normal" : "spacious" };
  else if (type === "gallery") base.settings = { eyebrow: copy?.eyebrow ?? "Gallery", heading: copy?.heading ?? "A closer look", columns: 4, padding: "spacious" };
  else if (type === "map") base.settings = { eyebrow: copy?.eyebrow ?? "Find us", heading: copy?.heading ?? "Visit us", padding: "normal" };
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
      muted: theme.muted || softenInk(theme.ink),
      font: theme.font,
      headingFont: theme.headlineFont,
      radius: radiusPx(theme.radius),
      containerWidth: theme.layout === "list" ? "standard" : "wide",
      buttonStyle: theme.radius === "2px" ? "solid" : theme.density === "compact" ? "pill" : "solid",
      headerStyle: theme.chrome?.header,
      footerStyle: theme.chrome?.footer,
      cardStyle: theme.chrome?.card,
    },
    sections,
  };
}
