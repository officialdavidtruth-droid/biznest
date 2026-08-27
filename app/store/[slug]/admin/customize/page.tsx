// Route: /store/[slug]/admin/customize
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { CustomizerClient } from "@/components/dashboard/customizer-client";
import { resolveStoreTheme, type Section } from "@/lib/template-themes";
import type { HeroOverrides, StoryOverrides } from "@/lib/actions/store";
import { defaultBuilderConfig, readBuilderConfig, type BuilderConfig } from "@/lib/builder-config";

const TEMPLATE_DEFAULT_SECTIONS: Section[] = ["hero", "catalog", "about", "testimonials", "contact"];
const OPT_IN_SECTIONS: Section[] = ["stats", "newsletter"];

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

  const pages = await prisma.storePage.findMany({ where: { storeId: store.id }, orderBy: { updatedAt: "desc" } });

  const overrides = store.sectionOverrides as { order?: Section[]; hidden?: Section[] } | null;
  const templateSections = (store.template?.config as { sections?: Section[] } | null)?.sections ?? TEMPLATE_DEFAULT_SECTIONS;
  const baseOrder = overrides?.order?.length ? overrides.order : templateSections;
  const missingOptIns = OPT_IN_SECTIONS.filter((s) => !baseOrder.includes(s));
  const initialOrder = [...baseOrder, ...missingOptIns];
  const initialHidden = overrides?.hidden ?? missingOptIns;

  // Content (hero + story) needs the same data the old standalone
  // /website-editor page used, now folded into this screen as a "Content"
  // panel instead of a separate route + page navigation.
  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const heroImage = store.bannerUrl || store.template?.previewUrl || null;
  const storyImage = store.storyImage || store.bannerUrl || store.template?.previewUrl || null;
  const savedBuilder = readBuilderConfig((overrides as { builder?: unknown } | null)?.builder);
  const initialBuilder: BuilderConfig = savedBuilder ?? defaultBuilderConfig(store.name, store.business.description, heroImage, store.businessType, { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices });

  return (
    <CustomizerClient
      slug={slug}
      storeName={store.name}
      currentTemplateName={store.template?.name ?? null}
      initialOrder={initialOrder}
      initialHidden={initialHidden}
      theme={theme}
      heroImage={heroImage}
      heroOverrides={(store.heroOverrides as HeroOverrides | null) ?? {}}
      storyImage={storyImage}
      storyOverrides={(store.storyOverrides as StoryOverrides | null) ?? {}}
      storyDescription={store.business.description ?? null}
      initialBuilder={initialBuilder}
      businessCategory={store.businessType}
      sellsProducts={store.business.sellsProducts}
      offersServices={store.business.offersServices}
      seoTitle={store.seoTitle ?? store.name}
      seoDescription={store.seoDescription ?? ""}
      pages={pages.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        body: (p.content as { body?: string } | null)?.body ?? "",
        isPublished: p.isPublished,
      }))}
    />
  );
    }
        
