import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BuilderClient } from "@/components/dashboard/builder-client";
import { SectionEditor } from "@/components/dashboard/section-editor";
import type { Section } from "@/lib/template-themes";

const ALL_SECTIONS: Section[] = ["hero", "catalog", "about", "testimonials", "contact"];

export default async function BuilderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true, template: true } });
  if (!store) notFound();

  const templates = await prisma.storeTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { tierRank: "asc" }],
    select: { id: true, name: true, category: true, tierRank: true, config: true },
  });

  const features = store.subscription?.features as { templateTier?: number } | null;
  const planRank = features?.templateTier ?? 1; // Free = 1 if no subscription set yet

  const overrides = store.sectionOverrides as { order?: Section[]; hidden?: Section[] } | null;
  const templateSections = (store.template?.config as { sections?: Section[] } | null)?.sections ?? ALL_SECTIONS;
  const initialOrder = overrides?.order?.length ? overrides.order : templateSections;
  const initialHidden = overrides?.hidden ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-xl font-semibold">Website builder</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Choose a starting template for {store.name}. You can switch anytime — your products and
          pages carry over.
        </p>
        <BuilderClient slug={slug} templates={templates} currentTemplateId={store.templateId} planRank={planRank} />
      </div>

      <SectionEditor slug={slug} initialOrder={initialOrder} initialHidden={initialHidden} />
    </div>
  );
}
