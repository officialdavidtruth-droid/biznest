import { getOrderForBuyer } from "@/lib/actions/order";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, Package, Truck, Home } from "lucide-react";

const ACCENT = "#0041C8";
const INK = "#141D23";
const SURFACE = "#F6FAFF";
const CARD = "#FFFFFF";
const CARD_ALT = "#E6EFF8";

const STEPS = [
  { key: "PAID", label: "Order confirmed", icon: CheckCircle2 },
  { key: "IN_PROGRESS", label: "Preparing your order", icon: Package },
  { key: "DELIVERED", label: "Delivered", icon: Truck },
  { key: "COMPLETED", label: "Completed", icon: Home },
];

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const order = await getOrderForBuyer(orderId);
  if (!order) notFound();

  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.key === order.status));
  const isPaid = order.status !== "PENDING_PAYMENT";

  return (
    <div style={{ background: SURFACE, color: INK, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <div
          style={{ background: isPaid ? "#DCFCE7" : CARD_ALT, borderRadius: "50%" }}
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center"
        >
          <CheckCircle2 className="h-8 w-8" style={{ color: isPaid ? "#16A34A" : ACCENT }} />
        </div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="mb-1 text-2xl font-extrabold">
          {isPaid ? "Order confirmed" : "Order received"}
        </h1>
        <p style={{ opacity: 0.65 }} className="mb-8 text-sm">
          {isPaid
            ? `Your payment went through. ${order.store.name} has been notified.`
            : "We're finalizing your payment — this can take a moment."}
        </p>

        {/* ---------- STATUS TRACKER ---------- */}
        {isPaid && (
          <div style={{ background: CARD, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="mb-6 p-6 text-left">
            <div className="flex items-center justify-between">
              {STEPS.map((step, i) => {
                const Icon = i <= stepIndex ? step.icon : Circle;
                const done = i <= stepIndex;
                return (
                  <div key={step.key} className="flex flex-1 flex-col items-center text-center">
                    <div
                      style={{ background: done ? ACCENT : `${INK}0d`, color: done ? "#fff" : `${INK}66` }}
                      className="mb-2 flex h-9 w-9 items-center justify-center rounded-full"
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span style={{ opacity: done ? 1 : 0.5, fontSize: 11 }} className="font-medium leading-tight">{step.label}</span>
                    {i < STEPS.length - 1 && (
                      <div style={{ background: i < stepIndex ? ACCENT : `${INK}14`, height: 2, width: "100%", marginTop: -30 }} className="hidden" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ background: CARD, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="mb-6 p-5 text-left text-sm">
          <p style={{ opacity: 0.55 }} className="mb-3 text-xs font-semibold uppercase tracking-wide">Order #{order.id.slice(-8).toUpperCase()}</p>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-1.5">
              <span>{item.product?.name ?? item.service?.name} × {item.quantity}</span>
              <span className="font-medium">{order.currency} {(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${INK}14` }} className="mt-2 flex justify-between pt-3 text-base font-bold">
            <span>Total</span>
            <span>{order.currency} {Number(order.total).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <Link
            href={`/store/${slug}`}
            style={{ border: `1px solid ${INK}22`, color: INK }}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold no-underline transition hover:bg-black/5"
          >
            Continue shopping
          </Link>
          <Link
            href="/orders"
            style={{ background: ACCENT, color: "#fff", boxShadow: `0 8px 20px ${ACCENT}4d` }}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold no-underline transition-transform hover:-translate-y-0.5"
          >
            View my orders
          </Link>
        </div>
      </div>
    </div>
  );
}
