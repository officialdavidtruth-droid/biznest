// Route: /store/[slug]/admin/products/[productId]/edit
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProduct } from "@/lib/actions/product";
import { ProductForm } from "@/components/forms/product-form";
import { getBusinessTerminology } from "@/lib/business-terminology";
import { ProductPreorderPanel } from "@/components/dashboard/product-preorder-panel";
import { preorderUnitsTaken } from "@/lib/preorder-server";

export default async function EditProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;

  const [product, store] = await Promise.all([
    getProduct(slug, productId),
    prisma.store.findUnique({ where: { slug }, select: { id: true, currency: true, business: { select: { category: true } } } }),
  ]);
  if (!product) notFound();

  const terminology = getBusinessTerminology(store?.business?.category);
  const categories = store
    ? await prisma.category.findMany({ where: { storeId: store.id, type: "PRODUCT" }, orderBy: { name: "asc" } })
    : [];

  // Decimals/Dates aren't serializable across the server -> client boundary.
  const plainProduct = JSON.parse(JSON.stringify(product));
  const preorderTaken = product.type === "PHYSICAL" ? await preorderUnitsTaken(product.id) : 0;

  return (
    <div>
      <ProductForm
        storeSlug={slug}
        categories={categories}
        entityLabel={terminology.catalogSingular}
        categoryLabel={terminology.category}
        businessCategory={store?.business?.category}
        storeCurrency={store?.currency}
        product={plainProduct}
      />
      {product.type === "PHYSICAL" && (
        <ProductPreorderPanel
          slug={slug}
          productId={product.id}
          taken={preorderTaken}
          initial={{ enabled: product.preorderEnabled, shipsOn: product.preorderShipsOn ? product.preorderShipsOn.toISOString().slice(0, 10) : "", limit: product.preorderLimit != null ? String(product.preorderLimit) : "" }}
        />
      )}
    </div>
  );
}
