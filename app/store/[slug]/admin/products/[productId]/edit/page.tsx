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

  const [product, categories] = await Promise.all([
    getProduct(slug, productId),
    prisma.category.findMany({ where: { type: "PRODUCT" }, orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Edit product</h1>
      <ProductForm storeSlug={slug} categories={categories} product={product} />
    </div>
  );
}
