import type { ReactNode } from "react";
import type { TemplateTheme } from "@/lib/template-themes";
import { TemplateShell } from "@/components/storefront/template-shell";
import { BuilderPageShell } from "@/components/storefront/builder-page-shell";
import { catalogDesign, catalogStoreInfo } from "@/lib/storefront/catalog-props";
import { usesTemplateChromeFor } from "@/lib/storefront/template-chrome";

/**
 * One header and footer for every page that has none of its own, chosen exactly the way the home page is:
 * Builder stores (and any store with a published Customize layout) get the Builder chrome, every other template
 * gets its own skin. This is what keeps the site from changing look between the home page and the last page.
 */
export async function StorefrontShell({ store, slug, theme, children }: { store: any; slug: string; theme: TemplateTheme; children: ReactNode }) {
  if (usesTemplateChromeFor(store.template?.name, store.sectionOverrides, { businessCategory: store.business?.category, storeBusinessType: store.businessType })) return <TemplateShell store={store} slug={slug} theme={theme}>{children}</TemplateShell>;
  return <BuilderPageShell store={catalogStoreInfo(store, slug) as any} design={catalogDesign(store, theme)}>{children}</BuilderPageShell>;
}
