import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { usesTemplateChrome } from "@/lib/storefront/template-chrome";
import { isHotelStore } from "@/lib/storefront-routing";
import { isGrandeurStore } from "@/lib/store-pages";
import { EXAMPLE_TEMPLATE_NAME, TASTEHOUSE_TEMPLATE_NAME } from "@/lib/template-themes";

/**
 * Which header + footer a customer sees on each core storefront page, as a plain function.
 *
 * "Chrome" is the header/footer pair a page is drawn with. Each id below names a concrete set of components:
 *
 *   builder       BuilderHeader / BuilderFooter (components/storefront/builder-renderer.tsx)
 *   universal     Header / Footer inside TemplateShell (universal-section-pages.tsx), skinned by the theme
 *   cart-inline   the bare <header> in app/store/[slug]/cart/cart-client.tsx (no footer)
 *   hotel         ThelusoHotel's Header / Footer (RefHeader / RefFooter for the reference-hotel skins)
 *   grandeur      GrandeurHeader / GrandeurFooter (grandeur-restaurant.tsx)
 *   tastehouse    Shell / Footer in tastehouse.tsx
 *   example       ExampleHeader / ExampleFooter (example-store.tsx)
 *   signature:<m> Shell / Footer in signature-screenshot-home.tsx for mode <m>
 *   legacy:<name> the template's own header/footer in legacy-template-renderer.tsx / reference-homes.tsx
 *
 * THIS MODEL MIRRORS THE ROUTES; it does not drive them yet. Each branch below is the decision the matching route
 * makes today (app/store/[slug]/{product,category,contact,cart}/page.tsx, storefront-runtime.tsx,
 * lib/storefront/builder-subpage.tsx). lib/__tests__/template-consistency.test.ts reads those route files and fails
 * if the markers this model relies on disappear, so the model cannot silently drift. The long-term fix is to make the
 * routes call pageChrome() instead of re-deciding, then delete the mirror.
 */
export const STOREFRONT_PAGES = ["home", "product", "category", "contact", "cart"] as const;
export type StorefrontPage = (typeof STOREFRONT_PAGES)[number];
export type ChromeId = string;

export type StoreChromeInput = {
  templateName?: string | null;
  businessCategory?: string | null;
  storeBusinessType?: string | null;
  /** The owner published a visual-builder layout (Customize > Website). It replaces the template's homepage. */
  publishedBuilder?: boolean;
  /** The owner wrote and published their own Contact page in Customize > Pages. */
  ownerContactPage?: boolean;
};

export function homeChrome(i: StoreChromeInput): ChromeId {
  // storefront-runtime.tsx: a published builder layout beats every template's own homepage.
  if (i.publishedBuilder) return "builder";
  const home = resolveHomeRenderer(i.templateName);
  switch (home.kind) {
    case "builder": return "builder";
    case "hotel": return "hotel";
    case "example": return "example";
    case "legacy": return `legacy:${home.name}`;
    case "screenshot": return `signature:${home.mode}`;
  }
}

export function pageChrome(page: StorefrontPage, i: StoreChromeInput): ChromeId {
  const identity = { businessCategory: i.businessCategory, storeBusinessType: i.storeBusinessType, templateName: i.templateName };
  const restaurantCategory = String(i.businessCategory ?? "").toLowerCase() === "restaurant";
  switch (page) {
    case "home":
      return homeChrome(i);

    // product/[productId]/page.tsx wraps every template, Builder included, in TemplateShell.
    case "product":
      return "universal";

    // category/[categoryId]/page.tsx
    case "category":
      if (isHotelStore(identity)) return "hotel"; // redirects to the hotel's own pages
      if (restaurantCategory) return "grandeur"; // GrandeurMenu, chosen by business category, not by template
      return usesTemplateChrome(i.templateName) ? "universal" : "builder";

    // cart/page.tsx
    case "cart":
      if (i.templateName === EXAMPLE_TEMPLATE_NAME) return "example";
      if (i.templateName === TASTEHOUSE_TEMPLATE_NAME) return "tastehouse";
      if (restaurantCategory && isGrandeurStore(identity)) return "grandeur";
      return usesTemplateChrome(i.templateName) ? "universal" : "cart-inline";

    // contact/page.tsx. Note its hotel check passes only storeBusinessType + templateName (no businessCategory),
    // unlike the category route, so a hotel known only by Business.category is not "hotel" here.
    case "contact":
      if (i.publishedBuilder || i.ownerContactPage) return "builder"; // renderBuilderSubpage(..., { onlyIfCustomised: true })
      if (isHotelStore({ storeBusinessType: i.storeBusinessType, templateName: i.templateName })) return "hotel";
      if (isGrandeurStore(identity)) return "grandeur"; // getGrandeurRestaurantData is non-null for any Grandeur store
      if (resolveHomeRenderer(i.templateName).kind === "builder") return "builder"; // renderBuilderSubpage, native template
      return "universal"; // renderUniversalSectionPage
  }
}
