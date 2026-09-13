import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TemplatesPageClient } from "@/components/dashboard/templates-page-client";
import { GRANDEUR_TEMPLATE_NAME, GRANDEUR_THEME, HOTEL_TEMPLATE_NAME, HOTEL_THEME, TASTEHOUSE_TEMPLATE_NAME, TASTEHOUSE_THEME, EXAMPLE_TEMPLATE_NAME, EXAMPLE_THEME } from "@/lib/template-themes";

export default async function TemplatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { subscription: true, template: true, business: true },
  });
  if (!store) notFound();

  const dbTemplates = await prisma.storeTemplate.findMany({
    where: { name: { in: [GRANDEUR_TEMPLATE_NAME, HOTEL_TEMPLATE_NAME, TASTEHOUSE_TEMPLATE_NAME, EXAMPLE_TEMPLATE_NAME] } },
    select: { id: true, name: true, category: true, tierRank: true, previewUrl: true, config: true },
  });
  const byName = new Map(dbTemplates.map((t) => [t.name, t]));
  const templates = [
    byName.get(GRANDEUR_TEMPLATE_NAME) ?? { id: `__grandeur__:${GRANDEUR_TEMPLATE_NAME}`, name: GRANDEUR_TEMPLATE_NAME, category: "Restaurant", tierRank: GRANDEUR_THEME.tierRank, previewUrl: null, config: GRANDEUR_THEME },
    byName.get(HOTEL_TEMPLATE_NAME) ?? { id: `__theluso__:${HOTEL_TEMPLATE_NAME}`, name: HOTEL_TEMPLATE_NAME, category: "Hotel", tierRank: HOTEL_THEME.tierRank, previewUrl: null, config: HOTEL_THEME },
    byName.get(TASTEHOUSE_TEMPLATE_NAME) ?? { id: `__tastehouse__:${TASTEHOUSE_TEMPLATE_NAME}`, name: TASTEHOUSE_TEMPLATE_NAME, category: "Restaurant", tierRank: TASTEHOUSE_THEME.tierRank, previewUrl: null, config: TASTEHOUSE_THEME },
    byName.get(EXAMPLE_TEMPLATE_NAME) ?? { id: `__example__:${EXAMPLE_TEMPLATE_NAME}`, name: EXAMPLE_TEMPLATE_NAME, category: "Electronics & Retail", tierRank: EXAMPLE_THEME.tierRank, previewUrl: null, config: EXAMPLE_THEME },
  ];

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
