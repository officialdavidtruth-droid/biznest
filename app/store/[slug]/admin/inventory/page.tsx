import { prisma } from "@/lib/prisma";

export default async function InventoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const items = await prisma.inventoryItem.findMany({
    where: { storeId: store.id },
    include: { product: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <span className="text-xs text-muted-foreground">{items.length} tracked items</span>
      </div>
      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">SKU</th><th className="px-4 py-2">In stock</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const low = i.quantity <= i.lowStockThreshold;
              return (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{i.product.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{i.sku ?? "—"}</td>
                  <td className="px-4 py-3">{i.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${low ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-700"}`}>
                      {i.quantity === 0 ? "Out of stock" : low ? "Low stock" : "In stock"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Nothing tracked yet. Physical products get an inventory row automatically once added.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
