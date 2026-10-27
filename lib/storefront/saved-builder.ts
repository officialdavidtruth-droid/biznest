import { readBuilderConfig, type BuilderConfig } from "@/lib/builder-config";
import { resolveHomeRenderer, type HomeRenderer } from "@/lib/storefront/resolve-renderer";

/**
 * The owner's published visual-builder layout, if the store has a valid one.
 * Written by "Publish visual website" in Customize and by the AI store builder
 * (sectionOverrides.builderVersion === 1). Switching template drops it (lib/actions/template.ts).
 */
export function getSavedBuilder(sectionOverrides: unknown): BuilderConfig | null {
  const raw = sectionOverrides as { builderVersion?: number; builder?: unknown } | null | undefined;
  return raw?.builderVersion === 1 ? readBuilderConfig(raw.builder) : null;
}

/**
 * Which component draws the homepage once the owner's choices are taken into account:
 * a published builder layout always wins over the template's own homepage (legacy, hotel,
 * screenshot, example), so "Website published" really changes the live site for every template.
 */
export function resolveEffectiveHomeRenderer(templateName: string | null | undefined, sectionOverrides: unknown): HomeRenderer {
  return getSavedBuilder(sectionOverrides) ? { kind: "builder" } : resolveHomeRenderer(templateName);
}
