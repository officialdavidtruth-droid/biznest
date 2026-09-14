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

  const dbTemplates = await prisma.storeTemplate.findMany({
    where: { isActive: true, name: { in: TEMPLATE_DEFINITIONS.map((t) => t.name) } },
    select: { id: true, name: true, category: true, tierRank: true, previewUrl: true, config: true },
    orderBy: [{ tierRank: "asc" }, { name: "asc" }],
  });

  // The database is allowed to lag behind the template registry (for example
  // before a migration/seed has been run). Build the complete 20-template
  // catalog from the registry and overlay real DB records when they exist.
  const byName = new Map(dbTemplates.map((t) => [t.name, t]));
  const templates = TEMPLATE_DEFINITIONS.map((definition) => {
    const db = byName.get(definition.name);
    return db ?? {
      id: definition.name === "Grandeur — Fine Dining Restaurant"
        ? `__grandeur__:${definition.name}`
        : definition.name === "Veloura — Superior Luxury Hotel"
        ? `__theluso__:${definition.name}`
        : definition.name === "TasteHouse — Food Delivery"
        ? `__tastehouse__:${definition.name}`
        : definition.name === "Example — Modern Electronics Store"
        ? `__example__:${definition.name}`
        : `__variant__:${definition.name}`,
      name: definition.name,
      category: definition.category,
      tierRank: definition.theme.tierRank,
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
