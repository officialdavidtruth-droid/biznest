import { readBuilderConfig } from "@/lib/builder-config";
import { templateThemeToBuilderConfig } from "@/lib/template-builder-config";
import type { TemplateTheme } from "@/lib/template-themes";

type StoreRow = {
  name: string; logoUrl: string | null; contactEmail: string | null; contactPhone: string | null;
  bannerUrl: string | null; sectionOverrides: unknown;
  business: { description: string | null; category: string | null; businessSubcategory: string | null; sellsProducts: boolean | null; offersServices: boolean | null; email: string | null; phone: string | null } | null;
};

/** The design the homepage uses: the owner's saved builder design if there is one, otherwise the template's own. */
export function catalogDesign(store: StoreRow, theme: TemplateTheme) {
  const overrides = store.sectionOverrides as { builderVersion?: number; builder?: unknown } | null;
  const saved = overrides?.builderVersion === 1 ? readBuilderConfig(overrides.builder) : null;
  return (saved ?? templateThemeToBuilderConfig(theme, store.name, store.business?.description, store.bannerUrl)).design;
}

/** Only plain, serialisable fields may cross into a client component (Prisma rows hold Decimals and Dates). */
export function catalogStoreInfo(store: StoreRow, slug: string) {
  return {
    name: store.name, slug, logoUrl: store.logoUrl ?? null,
    contactEmail: store.contactEmail ?? store.business?.email ?? null,
    contactPhone: store.contactPhone ?? store.business?.phone ?? null,
    business: {
      description: store.business?.description ?? null, category: store.business?.category ?? null,
      businessSubcategory: store.business?.businessSubcategory ?? null,
      sellsProducts: store.business?.sellsProducts ?? undefined, offersServices: store.business?.offersServices ?? undefined,
    },
  };
}
