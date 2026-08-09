import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TemplatesPageClient } from "@/components/dashboard/templates-page-client";

// Dedicated "pick a template" page, separate from Customize Website. Browsing
// and applying a template lives here now; Customize Website just shows
// whichever one is already selected and links back here to change it --
// keeps the two concerns (which template vs. how it's arranged) apart
// instead of both living inside the Customizer's left panel.
export default async function TemplatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { subscription: true, template: true },
  });
  if (!store) notFound();

  const templates = await prisma.storeTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { tierRank: "asc" }],
    select: { id: true, name: true, category: true, tierRank: true, previewUrl: true, config: true },
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
    />
  );
}
