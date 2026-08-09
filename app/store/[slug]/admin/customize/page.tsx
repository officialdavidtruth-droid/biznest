import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { CustomizerClient } from "@/components/dashboard/customizer-client";
import type { Section } from "@/lib/template-themes";

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
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true, template: true } });
  if (!store) notFound();
  if (!store.templateId) redirect(`/store/${slug}/admin/templates`);

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
      currentTemplateName={store.template?.name ?? null}
      initialOrder={initialOrder}
      initialHidden={initialHidden}
    />
  );
}
