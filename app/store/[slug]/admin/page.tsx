import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { seedSampleListings } from "@/lib/actions/store";

export default async function StoreDashboardHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) notFound();

  const [orderCount, productCount, serviceCount, pendingOrders] = await Promise.all([
    prisma.order.count({ where: { storeId: store.id } }),
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.service.count({ where: { storeId: store.id } }),
    prisma.order.count({ where: { storeId: store.id, status: "PENDING_PAYMENT" } }),
  ]);

  const cards = [
    { label: "Total orders", value: orderCount },
    { label: "Pending orders", value: pendingOrders },
    { label: "Products", value: productCount },
    { label: "Services", value: serviceCount },
  ];

  const isEmpty = productCount === 0 && serviceCount === 0;
  const seedForStore = seedSampleListings.bind(null, slug);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Overview</h1>

      {isEmpty && (
        <form action={seedForStore} className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium">Your storefront has no listings yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your live store page will look empty to visitors until you add something. Add
              two starter listings matching your template to see a fully designed storefront
              right away — edit or delete them anytime.
            </p>
          </div>
          <button className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Add starter listings
          </button>
        </form>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
