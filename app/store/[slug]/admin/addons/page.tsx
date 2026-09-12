// Route: /store/[slug]/admin/menu-addons
import { listProducts } from "@/lib/actions/product";
import { listAddonGroupsForProduct } from "@/lib/actions/addon";
import { AddonManager } from "@/components/dashboard/addon-manager";
import { prisma } from "@/lib/prisma";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function MenuAddonsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [products, store] = await Promise.all([
    listProducts(slug),
    prisma.store.findUnique({ where: { slug }, select: { businessType: true } }),
  ]);
  const terminology = getBusinessTerminology(store?.businessType);

  const groupsByProduct: Record<string, Awaited<ReturnType<typeof listAddonGroupsForProduct>>> = {};
  for (const p of products) {
    groupsByProduct[p.id] = await listAddonGroupsForProduct(slug, p.id);
  }

  return (
    <div className="bn-admin-page space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Add-ons & Extras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up optional and required extras for each {terminology.catalog.toLowerCase().replace(/s$/, "")} item — sides, toppings, spice levels, and more.
        </p>
      </div>

      <AddonManager
        slug={slug}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        initialGroupsByProduct={Object.fromEntries(
          Object.entries(groupsByProduct).map(([id, groups]) => [
            id,
            groups.map((g) => ({
              id: g.id,
              name: g.name,
              minSelect: g.minSelect,
              maxSelect: g.maxSelect,
              isActive: g.isActive,
              addons: g.addons.map((a) => ({ id: a.id, name: a.name, price: a.price.toString(), isActive: a.isActive })),
            })),
          ])
        )}
      />
    </div>
  );
}
