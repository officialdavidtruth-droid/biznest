import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SectionEditor } from "@/components/dashboard/section-editor";
import type { Section } from "@/lib/template-themes";

// The full set a vendor can arrange. The first 5 are what a niche template
// ships with by default; stats/features/newsletter are opt-in additions —
// this is genuinely "add what you need," not just "remove what you don't."
const TEMPLATE_DEFAULT_SECTIONS: Section[] = ["hero", "catalog", "about", "testimonials", "contact"];
const OPT_IN_SECTIONS: Section[] = ["stats", "features", "newsletter"];

export default async function LayoutEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store) notFound();

  const overrides = store.sectionOverrides as { order?: Section[]; hidden?: Section[] } | null;
  const templateSections = (store.template?.config as { sections?: Section[] } | null)?.sections ?? TEMPLATE_DEFAULT_SECTIONS;

  // Build the full row list: whatever the vendor already arranged (if any),
  // otherwise the template's defaults, always followed by any opt-in
  // sections not yet added — so they're visible to turn on, not hidden
  // from existence entirely.
  const baseOrder = overrides?.order?.length ? overrides.order : templateSections;
  const missingOptIns = OPT_IN_SECTIONS.filter((s) => !baseOrder.includes(s));
  const initialOrder = [...baseOrder, ...missingOptIns];
  const initialHidden = overrides?.hidden ?? missingOptIns;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Storefront Layout</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Control what appears on {store.name}'s homepage, in what order — including a few
        extras (stats, a "why choose us" grid, email signup) that aren't part of your
        template by default. Template and product/service editing live under Website
        Builder and Products/Services.
      </p>
      <SectionEditor slug={slug} initialOrder={initialOrder} initialHidden={initialHidden} />
    </div>
  );
}
