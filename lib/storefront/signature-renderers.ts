/**
 * Signature templates that own a dedicated (non-builder) renderer.
 *
 * Rule: a dedicated renderer may be used by exactly ONE catalog entry.
 * Every other signature template renders through the hardened Builder with
 * its own theme from SIGNATURE_TEMPLATE_CATALOG (see resolveStoreTheme).
 *
 * Maison and Grand are NOT listed: they render through the hotel journey (see resolveHomeRenderer).
 *
 * Renderers already owned elsewhere and therefore NOT allowed here:
 *  - legacy renderers (marketplace, fabtex, heenzy, arcova, rivora, nova, fresh)
 *    are owned by the legacy template of the same name;
 *  - "flavora-restaurant" is owned by "Grandeur — Fine Dining Restaurant";
 *  - "tastehouse" is owned by "TasteHouse — Food Delivery".
 */
export const SIGNATURE_DEDICATED_RENDERER: Readonly<Record<string, string>> = {
  "Bloom — Beauty Boutique": "belora",
};

export const RENDERERS_OWNED_ELSEWHERE: readonly string[] = [
  "marketplace", "fabtex", "heenzy", "arcova", "rivora", "nova", "fresh",
  "flavora-restaurant", "tastehouse",
];
