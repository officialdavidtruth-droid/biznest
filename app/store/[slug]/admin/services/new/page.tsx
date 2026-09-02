// Route: /store/[slug]/admin/services/new
import { prisma } from "@/lib/prisma";
import { ServiceForm } from "@/components/forms/service-form";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function NewServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, business: { select: { category: true } } } });
  const terminology = getBusinessTerminology(store?.business?.category);
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "SERVICE" }, orderBy: { name: "asc" } }) : [];

  return (
    <div>
      <ServiceForm
        storeSlug={slug}
        categories={categories}
        entityLabel={terminology.catalogSingular}
        categoryLabel={terminology.category}
        businessCategory={store?.business?.category}
      />
    </div>
  );
}
