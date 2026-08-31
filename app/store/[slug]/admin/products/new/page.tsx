// Route: /store/[slug]/admin/products/new
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/forms/product-form";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function NewProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  const terminology = getBusinessTerminology(store?.business?.category);
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "PRODUCT" }, orderBy: { name: "asc" } }) : [];

  return (
    <div>
      <div className="mb-6"><h1 className="text-xl font-semibold">{terminology.addCatalog}</h1><p className="mt-1 text-xs text-muted-foreground">{terminology.catalogDescription}</p></div>
      <ProductForm storeSlug={slug} categories={categories} entityLabel={terminology.catalogSingular} categoryLabel={terminology.category} />
    </div>
  );
}
