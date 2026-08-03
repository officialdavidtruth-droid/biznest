import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BuilderClient } from "@/components/dashboard/builder-client";

export default async function BuilderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) notFound();

  const templates = await prisma.storeTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true },
  });

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Website builder</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Choose a starting template for {store.name}. You can switch anytime — your products and
        pages carry over.
      </p>
      <BuilderClient slug={slug} templates={templates} currentTemplateId={store.templateId} />
    </div>
  );
}
