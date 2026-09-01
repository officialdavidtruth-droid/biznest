// Route: /store/[slug]/admin/menu-variants
import { listProducts } from "@/lib/actions/product";
import { listVariants } from "@/lib/actions/variant";
import { VariantManager } from "@/components/dashboard/variant-manager";

export default async function MenuVariantsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = await listProducts(slug);

  const variantsByProduct: Record<string, Awaited<ReturnType<typeof listVariants>>> = {};
  for (const p of products) {
    if (p.hasVariants) variantsByProduct[p.id] = await listVariants(slug, p.id);
  }

  return (
    <div className="bn-admin-page space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Menu Variants</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Give a menu item different sizes, portions, or options — each with its own price and stock.
        </p>
      </div>

      <VariantManager
        slug={slug}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          hasVariants: p.hasVariants,
          variantOptions: (p.variantOptions as any) ?? null,
        }))}
        initialVariantsByProduct={Object.fromEntries(
          Object.entries(variantsByProduct).map(([id, variants]) => [
            id,
            variants.map((v) => ({
              id: v.id,
              label: v.label,
              optionValues: v.optionValues as Record<string, string>,
              sku: v.sku,
              price: v.price ? v.price.toString() : null,
              quantity: v.quantity,
              isActive: v.isActive,
            })),
          ])
        )}
      />
    </div>
  );
}
