// Route: /store/[slug]/admin/services/[serviceId]/edit
import { prisma } from "@/lib/prisma";
import { getService } from "@/lib/actions/service";
import { ServiceForm } from "@/components/forms/service-form";
import { getBusinessTerminology } from "@/lib/business-terminology";
import { notFound } from "next/navigation";

export default async function EditServicePage({ params }: { params: Promise<{ slug: string; serviceId: string }> }) {
  const { slug, serviceId } = await params;

  const [service, store] = await Promise.all([
    getService(slug, serviceId),
    prisma.store.findUnique({ where: { slug }, select: { id: true, business: { select: { category: true } } } }),
  ]);
  if (!service) notFound();

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
        service={service}
      />
    </div>
  );
}
