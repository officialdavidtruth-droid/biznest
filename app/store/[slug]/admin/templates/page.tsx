import { getCanonicalBusinessType } from "@/lib/business-identity";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TemplatesPageClient } from "@/components/dashboard/templates-page-client";
import { TEMPLATE_DEFINITIONS } from "@/lib/template-definitions";
import { PUBLIC_TEMPLATE_REGISTRY } from "@/lib/template-registry";
import { GRANDEUR_TEMPLATE_NAME, HOTEL_TEMPLATE_NAME, TASTEHOUSE_TEMPLATE_NAME, EXAMPLE_TEMPLATE_NAME } from "@/lib/template-themes";

export default async function TemplatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { subscription: true, template: true, business: true },
  });
  if (!store) notFound();

  // Gallery = the public catalog (same list as /templates). A compatibility template (Grandeur, Veloura,
  // TasteHouse, Example) is only shown to a store that is already using it, so nobody new can pick a retired design.
  const publicNames = new Set(PUBLIC_TEMPLATE_REGISTRY.map((d) => d.name));
  const galleryDefinitions = TEMPLATE_DEFINITIONS.filter((d) => publicNames.has(d.name) || d.name === store.template?.name);
  const templateNames = galleryDefinitions.map((definition) => definition.name);
  const dbTemplates = await prisma.storeTemplate.findMany({
    where: { name: { in: templateNames } },
    select: { id: true, name: true, category: true, tierRank: true, previewUrl: true, config: true },
  });
  const byName = new Map(dbTemplates.map((t) => [t.name, t]));
  const templates = galleryDefinitions.map((definition) => {
    const existing = byName.get(definition.name);
    if (existing) return { ...existing, category: definition.category };
    return {
      id: definition.aliases[0] ? `${definition.aliases[0]}:${definition.name}` : definition.id,
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
      businessCategory={getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType })}
    />
  );
}
