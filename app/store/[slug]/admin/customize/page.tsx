import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CustomizerClient } from "@/components/dashboard/customizer-client";
import type { Section } from "@/lib/template-themes";

const TEMPLATE_DEFAULT_SECTIONS: Section[] = ["hero", "catalog", "about", "testimonials", "contact"];
const OPT_IN_SECTIONS: Section[] = ["stats", "features", "newsletter"];

// The single entry point for editing what a store's public website looks
// like — template, section order/visibility, and a live preview — laid
// out like the WordPress Customizer (left control panel, live site on the
// right, Publish at the top).
export default async function CustomizePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true, template: true } });
  if (!store) notFound();

  const templates = await prisma.storeTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { tierRank: "asc" }],
    select: { id: true, name: true, category: true, tierRank: true, previewUrl: true, config: true },
  });

  const features = store.subscription?.features as { templateTier?: number } | null;
  const planRank = features?.templateTier ?? 1;

  const overrides = store.sectionOverrides as { order?: Section[]; hidden?: Section[] } | null;
  const templateSections = (store.template?.config as { sections?: Section[] } | null)?.sections ?? TEMPLATE_DEFAULT_SECTIONS;
  const baseOrder = overrides?.order?.length ? overrides.order : templateSections;
  const missingOptIns = OPT_IN_SECTIONS.filter((s) => !baseOrder.includes(s));
  const initialOrder = [...baseOrder, ...missingOptIns];
  const initialHidden = overrides?.hidden ?? missingOptIns;

  return (
    <CustomizerClient
      slug={slug}
      storeName={store.name}
      templates={templates}
      currentTemplateId={store.templateId}
      planRank={planRank}
      initialOrder={initialOrder}
      initialHidden={initialHidden}
    />
  );
}
