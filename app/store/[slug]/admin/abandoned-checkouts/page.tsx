import { listAbandonedCheckouts } from "@/lib/actions/abandoned-checkout";
import { AbandonedCheckoutActions } from "@/components/dashboard/abandoned-checkout-actions";

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", WHATSAPP: "WhatsApp", SMS: "SMS" };

export default async function AbandonedCheckoutsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const checkouts = await listAbandonedCheckouts(slug);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Abandoned checkouts</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Buyers who added items and started checkout but didn&apos;t complete payment. Send a reminder
        to bring them back.
      </p>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Cart</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Left at</th>
              <th className="px-4 py-2">Already sent</th>
              <th className="px-4 py-2">Send a nudge</th>
            </tr>
          </thead>
          <tbody>
            {checkouts.map((order) => {
              const label = order.items
                .map((i) => i.product?.name ?? i.service?.name ?? "item")
                .join(", ");
              return (
                <tr key={order.id} className="border-b last:border-0 align-top">
                  <td className="px-4 py-3">{order.buyer.name ?? order.buyer.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{label}</td>
                  <td className="px-4 py-3">
                    {order.currency} {Number(order.total).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.abandonedNotifications.length === 0
                      ? "—"
                      : order.abandonedNotifications
                          .map((n) => `${CHANNEL_LABEL[n.channel]}${n.status === "FAILED" ? " (failed)" : ""}`)
                          .join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <AbandonedCheckoutActions slug={slug} orderId={order.id} />
                  </td>
                </tr>
              );
            })}
            {checkouts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No abandoned checkouts right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
