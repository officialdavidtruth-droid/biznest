import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { isHotelStore } from "@/lib/storefront-routing";
import { usesGrandeurSkin } from "@/lib/store-pages";

/**
 * Which header + footer a customer sees on each core storefront page, as a plain function.
 *
 * "Chrome" is the header/footer pair a page is drawn with. Each id below names a concrete set of components:
 *
 *   builder       BuilderHeader / BuilderFooter (components/storefront/builder-renderer.tsx)
 *   universal     Header / Footer inside TemplateShell (universal-section-pages.tsx), skinned by the theme
 *   cart-inline   (retired) the bare <header> that used to sit in cart-client.tsx; the cart is now wrapped like every other page
 *   hotel         ThelusoHotel's Header / Footer (RefHeader / RefFooter for the reference-hotel skins)
 *   grandeur      GrandeurHeader / GrandeurFooter (grandeur-restaurant.tsx)
 *   tastehouse    Shell / Footer in tastehouse.tsx
 *   example       ExampleHeader / ExampleFooter (example-store.tsx)
 *   signature:<m> Shell / Footer in signature-screenshot-home.tsx for mode <m>
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
    case "screenshot": return `signature:${home.mode}`;
  }
}

/** Mirrors usesTemplateChromeFor(): the shared pages wear the Builder chrome when the home page is drawn by the Builder. */
function sharedPagesUseBuilder(i: StoreChromeInput): boolean {
  return Boolean(i.publishedBuilder) || resolveHomeRenderer(i.templateName).kind === "builder";
}

export function pageChrome(page: StorefrontPage, i: StoreChromeInput): ChromeId {
  const identity = { businessCategory: i.businessCategory, storeBusinessType: i.storeBusinessType, templateName: i.templateName };
  switch (page) {
    case "home":
      return homeChrome(i);

    // product/[productId]/page.tsx wraps the item in StorefrontShell: Builder chrome for Builder stores, template skin otherwise.
    case "product":
      return sharedPagesUseBuilder(i) ? "builder" : "universal";

    // category/[categoryId]/page.tsx
    case "category":
      if (isHotelStore(identity)) return "hotel"; // redirects to the hotel's own pages
      if (usesGrandeurSkin(identity)) return "grandeur"; // GrandeurMenu: only for the Grandeur template (or a store with no template of its own)
      return sharedPagesUseBuilder(i) ? "builder" : "universal";

    // cart/page.tsx
    case "cart":
      if (usesGrandeurSkin(identity)) return "grandeur";
      return sharedPagesUseBuilder(i) ? "builder" : "universal"; // always inside StorefrontShell now (no bare inline header)

    // contact/page.tsx. Note its hotel check passes only storeBusinessType + templateName (no businessCategory),
    // unlike the category route, so a hotel known only by Business.category is not "hotel" here.
    case "contact":
      if (i.publishedBuilder || i.ownerContactPage) return "builder"; // renderBuilderSubpage(..., { onlyIfCustomised: true })
      if (isHotelStore({ storeBusinessType: i.storeBusinessType, templateName: i.templateName })) return "hotel";
      if (usesGrandeurSkin(identity)) return "grandeur";
      if (resolveHomeRenderer(i.templateName).kind === "builder") return "builder"; // renderBuilderSubpage, native template
      return "universal"; // renderUniversalSectionPage
  }
}
