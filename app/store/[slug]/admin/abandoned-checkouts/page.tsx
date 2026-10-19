// Route: /store/[slug]/admin/abandoned-checkouts
import { listAbandonedCheckouts } from "@/lib/actions/abandoned-checkout";
import { AbandonedCheckoutActions } from "@/components/dashboard/abandoned-checkout-actions";

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", WHATSAPP: "WhatsApp", SMS: "SMS" };

export default async function AbandonedCheckoutsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { slug } = await params;
  const { order: highlightId } = await searchParams;
  const checkouts = await listAbandonedCheckouts(slug);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Abandoned checkouts</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Buyers who started checkout but didn&apos;t complete payment. Send a reminder to bring them back.
      </p>

      <ul className="space-y-3">
        {checkouts.map((order) => {
          const label = order.items.map((i) => i.product?.name ?? i.service?.name ?? "item").join(", ");
          const shipping = order.shippingAddress as { fullName?: string } | null;
          const who = shipping?.fullName || order.buyer.name || order.buyer.email;
          return (
            <li
              key={order.id}
              className={`rounded-xl border bg-background p-4 ${order.id === highlightId ? "border-primary ring-2 ring-primary/20" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{who}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{label}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold">
                  {order.currency} {Number(order.total).toLocaleString()}
                </p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Left {new Date(order.createdAt).toLocaleString()}
                {order.abandonedNotifications.length > 0 && (
                  <>
                    {" · Sent: "}
                    {order.abandonedNotifications
                      .map((n) => `${CHANNEL_LABEL[n.channel]}${n.status === "FAILED" ? " (failed)" : ""}`)
                      .join(", ")}
                  </>
                )}
              </p>
              <div className="mt-3">
                <AbandonedCheckoutActions slug={slug} orderId={order.id} />
              </div>
            </li>
          );
        })}
        {checkouts.length === 0 && (
          <li className="rounded-xl border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            No abandoned checkouts right now.
          </li>
        )}
      </ul>
    </div>
  );
}
