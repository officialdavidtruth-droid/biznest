// Route: /store/[slug]/admin/products/[productId]/edit
import { prisma } from "@/lib/prisma";
import { getProduct } from "@/lib/actions/product";
import { ProductForm } from "@/components/forms/product-form";
import { getBusinessTerminology } from "@/lib/business-terminology";
import { notFound } from "next/navigation";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;

  const [product, store] = await Promise.all([
    getProduct(slug, productId),
    prisma.store.findUnique({ where: { slug }, select: { id: true, business: { select: { category: true } } } }),
  ]);
  const terminology = getBusinessTerminology(store?.business?.category);
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "PRODUCT" }, orderBy: { name: "asc" } }) : [];

  if (!product) notFound();

  return (
    <div className="bn-admin-page">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Edit {terminology.catalogSingular}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{terminology.catalogDescription}</p>
      </div>
      <ProductForm
        storeSlug={slug}
        categories={categories}
        product={product}
        entityLabel={terminology.catalogSingular}
        categoryLabel={terminology.category}
      />
    </div>
  );
}
