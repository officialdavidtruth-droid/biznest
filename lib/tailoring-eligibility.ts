/**
 * Does this Fashion business do made-to-measure work?
 *
 * The specialty chosen at onboarding decides. Clothing, footwear, bags, jewellery, thrift, kids, fabrics and
 * uniforms are shops, so they get no Tailoring workspace, no "Order a custom outfit" page and no menu link.
 * Tailoring & Bespoke and Traditional & Native Wear do. A Fashion business with no specialty saved yet (older
 * accounts) keeps the workspace, so nobody loses a feature they already use.
 */
export function isFashionCategory(category: string | null | undefined): boolean {
  return /^fashion$/i.test(String(category ?? "").trim());
}

const TAILORING_SPECIALTY = /tailor|bespoke|traditional|native/i;

export function fashionDoesTailoring(subcategory: string | null | undefined): boolean {
  const s = String(subcategory ?? "").trim();
  if (!s) return true;
  return TAILORING_SPECIALTY.test(s);
}

export function usesTailoring(category: string | null | undefined, subcategory: string | null | undefined): boolean {
  return isFashionCategory(category) && fashionDoesTailoring(subcategory);
}
