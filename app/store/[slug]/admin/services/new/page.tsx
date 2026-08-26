import { prisma } from "@/lib/prisma";
import { getProduct } from "@/lib/actions/product";
import { ProductForm } from "@/components/forms/product-form";
import { notFound } from "next/navigation";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;

  const [product, store] = await Promise.all([
    getProduct(slug, productId),
    prisma.store.findUnique({ where: { slug }, select: { id: true } }),
  ]);
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "PRODUCT" }, orderBy: { name: "asc" } }) : [];

  if (!product) notFound();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Edit product</h1>
      <ProductForm storeSlug={slug} categories={categories} product={product} />
    </div>
  );
}
