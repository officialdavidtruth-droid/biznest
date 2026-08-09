import { getOrderForBuyer } from "@/lib/actions/order";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, Package, Truck, Home } from "lucide-react";
import { isVioletTemplate, isMarketplaceTemplate, isArcovaTemplate, isNovaTemplate, VIOLET, MARKETPLACE, ARCOVA, NOVA } from "@/lib/template-themes";
import { VioletHeader, VioletFooter } from "@/components/storefront/templates/violet-chrome";
import { MarketplaceHeader, MarketplaceFooter } from "@/components/storefront/templates/marketplace-chrome";
import { ArcovaHeader, ArcovaFooter } from "@/components/storefront/templates/arcova-chrome";
import { NovaHeader, NovaFooter } from "@/components/storefront/templates/nova-chrome";
import { getStoreCategoryTree } from "@/lib/storefront-categories";

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

  const violet = isVioletTemplate(order.store.template?.name);
  const marketplace = isMarketplaceTemplate(order.store.template?.name);
  const arcova = isArcovaTemplate(order.store.template?.name);
  const nova = isNovaTemplate(order.store.template?.name);
  const accent = violet ? VIOLET.accent : marketplace ? MARKETPLACE.blue : arcova ? ARCOVA.accent : nova ? NOVA.gold : ACCENT;
  const ink = violet ? VIOLET.ink : marketplace ? MARKETPLACE.ink : arcova ? ARCOVA.ink : nova ? NOVA.cream : INK;
  const cardRadius = violet ? 20 : marketplace ? 4 : arcova ? 0 : nova ? 2 : 16;
  const cardShadow = violet ? "0 5px 20px #20144b0a" : marketplace ? "none" : arcova ? "none" : nova ? "none" : "0 1px 3px rgba(18,18,18,0.06)";
  const cardBorder = marketplace ? `1px solid ${MARKETPLACE.border}` : arcova ? `1px solid ${ARCOVA.border}` : nova ? `1px solid ${NOVA.line}` : "none";
  const pillRadius = violet ? 100 : marketplace ? 3 : arcova ? 0 : nova ? 2 : 8;
  const cardBg = nova ? NOVA.charcoal : "#fff";

  const body = (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <div
        style={{ background: isPaid ? "#DCFCE7" : `${ink}0d`, borderRadius: "50%" }}
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center"
      >
        <CheckCircle2 className="h-8 w-8" style={{ color: isPaid ? "#16A34A" : accent }} />
      </div>
      <h1 className="mb-1 text-2xl font-extrabold">
        {isPaid ? "Order confirmed" : "Order received"}
      </h1>
      <p style={{ opacity: 0.65 }} className="mb-8 text-sm">
        {isPaid
          ? `Your payment went through. ${order.store.name} has been notified.`
          : "We're finalizing your payment — this can take a moment."}
      </p>

      {/* ---------- STATUS TRACKER ---------- */}
      {isPaid && (
        <div style={{ background: cardBg, borderRadius: cardRadius, boxShadow: cardShadow, border: cardBorder }} className="mb-6 p-6 text-left">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const Icon = i <= stepIndex ? step.icon : Circle;
              const done = i <= stepIndex;
              return (
                <div key={step.key} className="flex flex-1 flex-col items-center text-center">
                  <div
                    style={{ background: done ? accent : `${ink}0d`, color: done ? "#fff" : `${ink}66` }}
                    className="mb-2 flex h-9 w-9 items-center justify-center rounded-full"
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span style={{ opacity: done ? 1 : 0.5, fontSize: 11 }} className="font-medium leading-tight">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: cardBg, borderRadius: cardRadius, boxShadow: cardShadow, border: cardBorder }} className="mb-6 p-5 text-left text-sm">
        <p style={{ opacity: 0.55 }} className="mb-3 text-xs font-semibold uppercase tracking-wide">Order #{order.id.slice(-8).toUpperCase()}</p>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-1.5">
            <span>{item.product?.name ?? item.service?.name} × {item.quantity}</span>
            <span className="font-medium">{order.currency} {(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${ink}14` }} className="mt-2 flex justify-between pt-3 text-base font-bold">
          <span>Total</span>
          <span>{order.currency} {Number(order.total).toLocaleString()}</span>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <Link
          href={`/store/${slug}`}
          style={{ border: `1px solid ${ink}22`, color: ink, borderRadius: pillRadius }}
          className="px-5 py-2.5 text-sm font-semibold no-underline transition hover:bg-black/5"
        >
          Continue shopping
        </Link>
        <Link
          href="/orders"
          style={{ background: accent, color: "#fff", borderRadius: pillRadius }}
          className="px-5 py-2.5 text-sm font-semibold no-underline transition-transform hover:-translate-y-0.5"
        >
          View my orders
        </Link>
      </div>
    </div>
  );

  if (violet) {
    const navCategories = await getStoreCategoryTree(order.storeId);
    const social = (order.store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: VIOLET.bg, color: VIOLET.ink, fontFamily: VIOLET.font, minHeight: "100vh" }}>
        <VioletHeader store={order.store} slug={slug} navCategories={navCategories} />
        {body}
        <VioletFooter store={order.store} slug={slug} social={social} />
      </div>
    );
  }

  if (marketplace) {
    const navCategories = await getStoreCategoryTree(order.storeId);
    const social = (order.store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#fff", color: MARKETPLACE.ink, fontFamily: MARKETPLACE.font, fontSize: 12, minHeight: "100vh" }}>
        <MarketplaceHeader store={order.store} slug={slug} navCategories={navCategories} />
        {body}
        <MarketplaceFooter store={order.store} slug={slug} social={social} />
      </div>
    );
  }

  if (arcova) {
    const navCategories = await getStoreCategoryTree(order.storeId);
    const social = (order.store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: ARCOVA.paper, color: ARCOVA.ink, fontFamily: ARCOVA.font, minHeight: "100vh" }}>
        <ArcovaHeader store={order.store} slug={slug} navCategories={navCategories} />
        {body}
        <ArcovaFooter store={order.store} slug={slug} social={social} />
      </div>
    );
  }

  if (nova) {
    const navCategories = await getStoreCategoryTree(order.storeId);
    const social = (order.store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: NOVA.black, color: NOVA.cream, fontFamily: NOVA.font, minHeight: "100vh" }}>
        <NovaHeader store={order.store} slug={slug} navCategories={navCategories} />
        {body}
        <NovaFooter store={order.store} slug={slug} social={social} />
      </div>
    );
  }

  return (
    <div style={{ background: SURFACE, color: INK, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {body}
    </div>
  );
}
