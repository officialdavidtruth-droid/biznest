// Route: /store/[slug]/admin/products/new
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/forms/product-form";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function NewProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, business: { select: { category: true } } } });
  const terminology = getBusinessTerminology(store?.business?.category);
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "PRODUCT" }, orderBy: { name: "asc" } }) : [];

  return (
    <div>
      <ProductForm
        storeSlug={slug}
        categories={categories}
        entityLabel={terminology.catalogSingular}
        categoryLabel={terminology.category}
        businessCategory={store?.business?.category}
      />
    </div>
  );
}
