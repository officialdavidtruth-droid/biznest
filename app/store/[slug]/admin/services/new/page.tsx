// Route: /store/[slug]/admin/services/new
import { prisma } from "@/lib/prisma";
import { ServiceForm } from "@/components/forms/service-form";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function NewServicePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ category?: string }> }) {
  const { slug } = await params;
  const { category: presetCategory } = await searchParams;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, business: { select: { category: true } } } });
  const terminology = getBusinessTerminology(store?.business?.category);
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "SERVICE" }, orderBy: { name: "asc" } }) : [];

  return (
    <div>
      <ServiceForm
        storeSlug={slug}
        categories={categories}
        defaultCategoryId={categories.find((c) => c.id === presetCategory)?.id}
        entityLabel={terminology.catalogSingular}
        categoryLabel={terminology.category}
        businessCategory={store?.business?.category}
      />
    </div>
  );
}
