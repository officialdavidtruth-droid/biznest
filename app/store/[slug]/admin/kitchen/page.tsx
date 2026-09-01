// Route: /store/[slug]/admin/kitchen
import { listOrders } from "@/lib/actions/order";
import { KitchenBoard } from "@/components/dashboard/kitchen-board";

export default async function KitchenOperationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const orders = await listOrders(slug);

  const kitchenOrders = orders
    .filter((o) => ["PAID", "IN_PROGRESS", "DELIVERED"].includes(o.status))
    .map((o) => ({
      id: o.id,
      displayId: o.id.slice(-6).toUpperCase(),
      status: o.status,
      customerName: o.buyer?.name ?? "Walk-in Customer",
      channel: o.channel === "POS" ? "Dine In" : "Online Order",
      createdAt: o.createdAt.toString(),
      items: o.items.map((it) => ({ name: it.product?.name ?? it.service?.name ?? "Item", quantity: it.quantity })),
    }));

  return (
    <div className="bn-admin-page">
      <KitchenBoard slug={slug} initialOrders={kitchenOrders} />
    </div>
  );
}
