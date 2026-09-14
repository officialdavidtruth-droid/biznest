import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TemplatesPageClient } from "@/components/dashboard/templates-page-client";
import { GRANDEUR_TEMPLATE_NAME, GRANDEUR_THEME, HOTEL_TEMPLATE_NAME, HOTEL_THEME, TASTEHOUSE_TEMPLATE_NAME, TASTEHOUSE_THEME, EXAMPLE_TEMPLATE_NAME, EXAMPLE_THEME } from "@/lib/template-themes";
import { TEMPLATE_DEFINITIONS } from "@/lib/template-definitions";
import { TEMPLATE_VARIANTS } from "@/lib/template-variants";

export default async function TemplatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { subscription: true, template: true, business: true },
  });
  if (!store) notFound();

  const dbTemplates = await prisma.storeTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, category: true, tierRank: true, previewUrl: true, config: true },
  });
  const byName = new Map(dbTemplates.map((t) => [t.name, t]));
  const templates = TEMPLATE_DEFINITIONS.map((definition) => {
    const existing = byName.get(definition.name);
    if (existing) return existing;
    const tierRank = TEMPLATE_VARIANTS.find((v) => v.name === definition.name)?.tierRank
      ?? (definition.name === EXAMPLE_TEMPLATE_NAME ? EXAMPLE_THEME.tierRank
      : definition.name === TASTEHOUSE_TEMPLATE_NAME ? TASTEHOUSE_THEME.tierRank
      : definition.name === HOTEL_TEMPLATE_NAME ? HOTEL_THEME.tierRank
      : GRANDEUR_THEME.tierRank);
    return {
      id: `__variant__:${definition.name}`,
      name: definition.name,
      category: definition.category,
      tierRank,
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
