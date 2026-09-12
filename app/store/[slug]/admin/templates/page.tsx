import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TemplatesPageClient } from "@/components/dashboard/templates-page-client";
import { GRANDEUR_TEMPLATE_NAME, GRANDEUR_THEME } from "@/lib/template-themes";

export default async function TemplatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { subscription: true, template: true, business: true },
  });
  if (!store) notFound();

  const dbTemplate = await prisma.storeTemplate.findUnique({
    where: { name: GRANDEUR_TEMPLATE_NAME },
    select: { id: true, name: true, category: true, tierRank: true, previewUrl: true, config: true },
  });

  const templates = [dbTemplate ? {
    id: dbTemplate.id,
    name: dbTemplate.name,
    category: "Restaurant",
    tierRank: dbTemplate.tierRank,
    previewUrl: dbTemplate.previewUrl,
    config: dbTemplate.config,
  } : {
    id: `__grandeur__:${GRANDEUR_TEMPLATE_NAME}`,
    name: GRANDEUR_TEMPLATE_NAME,
    category: "Restaurant",
    tierRank: GRANDEUR_THEME.tierRank,
    previewUrl: null,
    config: GRANDEUR_THEME,
  }];

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
