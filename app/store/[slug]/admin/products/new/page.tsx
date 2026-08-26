// Route: /store/[slug]/admin/products/new
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/forms/product-form";

export default async function NewProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "PRODUCT" }, orderBy: { name: "asc" } }) : [];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Add product</h1>
      <ProductForm storeSlug={slug} categories={categories} />
    </div>
  );
}
