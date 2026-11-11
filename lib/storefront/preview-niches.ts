/** Business types the template preview can show sample content for (used by the temporary "Preview as" switch in the dashboard). */
export const PREVIEW_NICHES = [
  "Fashion", "Beauty", "Electronics", "Retail", "Food & Groceries", "Home & Furniture", "Restaurant", "Salon",
  "Photography", "Agency", "Professional Services", "Cleaning", "Construction", "Health & Fitness", "Event Planning",
  "Logistics", "HR & Recruitment", "Real Estate", "Travel & Tourism", "Automotive", "Health",
] as const;

/** Pages the preview can show for a template, in the order the dashboard lists them. */
export const PREVIEW_VIEWS: Array<[view: string, label: string]> = [
  ["", "Home"], ["shop", "Shop"], ["product", "Product"], ["cart", "Cart"], ["checkout", "Checkout"],
  ["pay", "Payment"], ["about", "About"], ["contact", "Contact"], ["categories", "Categories"],
];

export function previewUrl(template: string, view: string, niche: string | null): string {
  const base = `/template-preview/${encodeURIComponent(template)}${view ? `/${view}` : ""}`;
  return niche ? `${base}?niche=${encodeURIComponent(niche)}` : base;
}
