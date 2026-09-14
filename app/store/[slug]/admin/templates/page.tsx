import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TemplatesPageClient } from "@/components/dashboard/templates-page-client";
import { TEMPLATE_DEFINITIONS } from "@/lib/template-definitions";

export default async function TemplatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { subscription: true, template: true, business: true },
  });
  if (!store) notFound();

  const templateNames = TEMPLATE_DEFINITIONS.map((definition) => definition.name);
  const dbTemplates = await prisma.storeTemplate.findMany({
    where: { name: { in: templateNames } },
    select: { id: true, name: true, category: true, tierRank: true, previewUrl: true, config: true },
  });
  const byName = new Map(dbTemplates.map((t) => [t.name, t]));
  const templates = TEMPLATE_DEFINITIONS.map((definition) => {
    const existing = byName.get(definition.name);
    if (existing) return existing;
    return {
      id: `__variant__:${definition.name}`,
      name: definition.name,
      category: definition.category,
      tierRank: (definition.theme as any).tierRank ?? 1,
      previewUrl: null,
      config: definition.theme,
    };
  });

  const features = store.subscription?.features as { templateTier?: number } | null;
  const planRank = features?.templateTier ?? 1;

  return (
    <TemplatesPageClient
      slug={slug}
      storeName={store.name}
      templates={templates}
      currentTemplateId={store.templateId}
      currentTemplateName={store.template?.name ?? null}
      planRank={planRank}
      businessCategory={store.businessType}
    />
  );
}
