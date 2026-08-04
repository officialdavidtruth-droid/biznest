import { getOrderForBuyer } from "@/lib/actions/order";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const order = await getOrderForBuyer(orderId);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
      <h1 className="mb-1 text-xl font-semibold">
        {order.status === "PAID" ? "Order confirmed" : "Order received"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {order.status === "PAID"
          ? `Your payment went through. ${order.store.name} has been notified.`
          : "We're finalizing your payment — this can take a moment."}
      </p>

      <div className="mb-6 rounded-lg border p-4 text-left text-sm">
        <p className="mb-2 text-xs text-muted-foreground">Order #{order.id.slice(-8).toUpperCase()}</p>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-1">
            <span>{item.product?.name ?? item.service?.name} × {item.quantity}</span>
            <span>{order.currency} {(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-2 font-medium">
          <span>Total</span>
          <span>{order.currency} {Number(order.total).toLocaleString()}</span>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <Link href={`/store/${slug}`} className="rounded-md border px-4 py-2 text-sm font-medium">
          Continue shopping
        </Link>
        <Link
          href="/orders"
          className="rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: "var(--bn-marigold)", color: "var(--bn-ink)" }}
        >
          View my orders
        </Link>
      </div>
    </div>
  );
}
