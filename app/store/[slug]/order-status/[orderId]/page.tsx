// Route: /store/[slug]/order-status/[orderId]?t=<token>
// Sign-in-free order tracking (the link in the receipt email). Shows status and items only.
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyOrderTrackingToken } from "@/lib/order-tracking";
import { orderNumber } from "@/lib/customer-messages";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const STEPS = ["Order placed", "Paid", "Being prepared", "Ready / on its way", "Completed"];
function stepFor(status: string): number {
  switch (status) {
    case "PENDING_PAYMENT": return 0;
    case "PAID": return 1;
    case "IN_PROGRESS": return 2;
    case "DELIVERED": return 3;
    case "COMPLETED": return 4;
    default: return -1;
  }
}
const SPECIAL: Record<string, string> = {
  PENDING_PAYMENT: "Waiting for payment.",
  CANCELLED: "This order was cancelled.",
  REFUNDED: "This order was refunded.",
  DISPUTED: "This order is under review.",
};

export default async function OrderStatusPage({ params, searchParams }: { params: Promise<{ slug: string; orderId: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ slug, orderId }, { t }] = await Promise.all([params, searchParams]);
  if (!verifyOrderTrackingToken(orderId, t)) notFound();
  const order = await prisma.order.findFirst({
    where: { id: orderId, store: { slug } },
    select: {
      id: true, status: true, currency: true, total: true, createdAt: true, trackingUrl: true, deliveryStatus: true,
      store: { select: { name: true, contactEmail: true, contactPhone: true, themeColors: true } },
      items: { select: { quantity: true, unitPrice: true, product: { select: { name: true } }, service: { select: { name: true } }, variant: { select: { label: true } } } },
    },
  });
  if (!order) notFound();

  const accent = ((order.store.themeColors as { primary?: string } | null)?.primary ?? "").match(/^#[0-9a-f]{3,8}$/i)?.[0] ?? "#0f172a";
  const step = stepFor(order.status);
  const money = (n: number) => `${order.currency} ${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
  const contact = order.store.contactPhone || order.store.contactEmail;

  return (
    <main className="mx-auto max-w-md px-5 py-8 text-slate-900">
      <p className="text-sm text-slate-500">{order.store.name}</p>
      <h1 className="text-xl font-bold">Order #{orderNumber(order.id)}</h1>
      <p className="text-sm text-slate-500">Placed {order.createdAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>

      <section className="mt-5 rounded-xl border border-slate-200 p-4">
        {step >= 0 ? (
          <ol className="space-y-3">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span style={i <= step ? { background: accent, color: "#fff" } : undefined} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">{i <= step ? "✓" : i + 1}</span>
                <span className={i === step ? "font-semibold" : i < step ? "text-slate-700" : "text-slate-400"}>{label}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm font-medium">{SPECIAL[order.status] ?? "Status unavailable."}</p>
        )}
        {step === 0 && <p className="mt-3 text-sm text-slate-600">{SPECIAL.PENDING_PAYMENT}</p>}
        {order.trackingUrl && /^https:\/\//.test(order.trackingUrl) && (
          <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ background: accent }} className="mt-4 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white no-underline">Track delivery</a>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 p-4 text-sm">
        <ul className="space-y-2">
          {order.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{it.quantity} × {it.product?.name ?? it.service?.name ?? "Item"}{it.variant?.label ? ` (${it.variant.label})` : ""}</span>
              <span className="shrink-0">{money(Number(it.unitPrice) * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-semibold"><span>Total</span><span>{money(Number(order.total))}</span></p>
      </section>

      {contact && <p className="mt-5 text-center text-sm text-slate-500">Questions? Contact {order.store.name}: {contact}</p>}
    </main>
  );
}
