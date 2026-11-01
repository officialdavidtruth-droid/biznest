import { ownerPageBody } from "@/lib/storefront/page-registry";
import { ownerPageBlocks } from "@/lib/storefront/page-blocks";
import { loadCatalogOptions } from "@/lib/storefront/page-block-catalog";
import { readAllSystemSections } from "@/lib/storefront/system-sections";
import { systemPageSupport } from "@/lib/storefront/system-page-support";
import { getCanonicalBusinessType } from "@/lib/business-identity";
// Route: /store/[slug]/admin/customize
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { CustomizerClient } from "@/components/dashboard/customizer-client";
import { resolveStoreTheme } from "@/lib/template-themes";
import type { HeroOverrides, StoryOverrides } from "@/lib/actions/store";
import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { getSavedBuilder } from "@/lib/storefront/saved-builder";
import { defaultBuilderConfig, readBuilderConfig, type BuilderConfig } from "@/lib/builder-config";

// The single entry point for editing what a store's public website looks
// like — section order/visibility and a live preview — laid out like the
// WordPress Customizer (left control panel, live site on the right).
// Choosing *which* template lives on its own page (/admin/templates); a
// store with none picked yet is sent there first, since there's nothing
// to arrange until a template exists.
export default async function CustomizePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true, template: true, business: true } });
  if (!store) notFound();
  if (!store.templateId) redirect(`/${slug}/admin/templates`);

  const [pages, catalogOptions] = await Promise.all([
    prisma.storePage.findMany({ where: { storeId: store.id }, orderBy: { updatedAt: "desc" } }),
    loadCatalogOptions(store.id),
  ]);

  const overrides = store.sectionOverrides as { builder?: unknown } | null;

  // Content (hero + story) needs the same data the old standalone
  // /website-editor page used, now folded into this screen as a "Content"
  // panel instead of a separate route + page navigation.
  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const heroImage = store.bannerUrl || store.template?.previewUrl || null;
  const storyImage = store.storyImage || store.bannerUrl || store.template?.previewUrl || null;
  const savedBuilder = readBuilderConfig((overrides as { builder?: unknown } | null)?.builder);
  const initialBuilder: BuilderConfig = savedBuilder ?? defaultBuilderConfig(store.name, store.business.description, heroImage, getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType }), { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices });

  return (
    <CustomizerClient
      slug={slug}
      storeName={store.name}
      currentTemplateName={store.template?.name ?? null}
      theme={theme}
      heroImage={heroImage}
      heroOverrides={(store.heroOverrides as HeroOverrides | null) ?? {}}
      storyImage={storyImage}
      storyOverrides={(store.storyOverrides as StoryOverrides | null) ?? {}}
      storyDescription={store.business.description ?? null}
      initialBuilder={initialBuilder}
      businessCategory={getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType })}
      sellsProducts={store.business.sellsProducts}
      offersServices={store.business.offersServices}
      seoTitle={store.seoTitle ?? store.name}
      seoDescription={store.seoDescription ?? ""}
      templateHasOwnHomepage={resolveHomeRenderer(store.template?.name).kind !== "builder"}
      homeKind={resolveHomeRenderer(store.template?.name).kind}
      builderPublished={!!getSavedBuilder(store.sectionOverrides)}
      catalogOptions={catalogOptions}
      systemSections={readAllSystemSections(store.sectionOverrides)}
      systemSupport={systemPageSupport({ templateName: store.template?.name, businessCategory: store.business?.category })}
      // Only owner-written text pages. Template content rows (hotel-*, events ...) and legacy empty
      // placeholders (Home, Products, Testimonials ...) are not pages the owner can edit here.
      pages={pages
        .filter((p) => ownerPageBody(p.content) !== null)
        .map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          body: ownerPageBody(p.content) ?? "",
          blocks: ownerPageBlocks(p.content),
          isPublished: p.isPublished,
        }))}
    />
  );
    }
        
