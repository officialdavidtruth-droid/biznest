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
  const articleRows = store
    ? await prisma.article.findMany({ where: { storeId: store.id, publishedAt: { not: null, lte: new Date() } }, orderBy: { publishedAt: "desc" }, take: 100, select: { title: true, handle: true, blog: { select: { handle: true } } } })
    : [];
  const articles = articleRows.map((a) => ({ value: `${a.blog.handle}/${a.handle}`, label: a.title }));
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "SERVICE" }, orderBy: { name: "asc" } }) : [];

  return (
    <div>
      <ServiceForm
        storeSlug={slug}
        categories={categories}
        entityLabel={terminology.catalogSingular}
        categoryLabel={terminology.category}
        businessCategory={store?.business?.category}
        articles={articles}
        service={service}
      />
    </div>
  );
}
