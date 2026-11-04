// Route: /store/[slug]/admin/products/new
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/forms/product-form";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function NewProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ category?: string }> }) {
  const { slug } = await params;
  const { category: presetCategory } = await searchParams;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, currency: true, business: { select: { category: true } } },
  });
  const terminology = getBusinessTerminology(store?.business?.category);
  const categories = store
    ? await prisma.category.findMany({ where: { storeId: store.id, type: "PRODUCT" }, orderBy: { name: "asc" } })
    : [];

  return (
    <div>
      <ProductForm
        storeSlug={slug}
        categories={categories}
        defaultCategoryId={categories.find((c) => c.id === presetCategory)?.id}
        entityLabel={terminology.catalogSingular}
        categoryLabel={terminology.category}
        businessCategory={store?.business?.category}
        storeCurrency={store?.currency}
      />
    </div>
  );
}
