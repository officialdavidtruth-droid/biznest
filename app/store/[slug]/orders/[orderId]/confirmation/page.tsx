import { getOrderForBuyer } from "@/lib/actions/order";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, Package, Truck, Home, XCircle, RotateCcw, AlertTriangle, Clock } from "lucide-react";
import { isVioletTemplate, isMarketplaceTemplate, isArcovaTemplate, isNovaTemplate, isPremiumTemplate, VIOLET, MARKETPLACE, ARCOVA, NOVA, PREMIUM } from "@/lib/template-themes";
import { VioletHeader, VioletFooter } from "@/components/storefront/templates/violet-chrome";
import { MarketplaceHeader, MarketplaceFooter } from "@/components/storefront/templates/marketplace-chrome";
import { ArcovaHeader, ArcovaFooter } from "@/components/storefront/templates/arcova-chrome";
import { NovaHeader, NovaFooter } from "@/components/storefront/templates/nova-chrome";
import { PremiumHeader, PremiumFooter } from "@/components/storefront/templates/premium-chrome";
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

// Terminal/non-progressing states each get their own icon, color, and
// copy — previously any status other than PENDING_PAYMENT (including
// CANCELLED, REFUNDED, DISPUTED) fell through to the "paid" branch and
// rendered the green "Order confirmed" checkmark + progress tracker,
// which is wrong for an order the buyer or seller cancelled.
const STATUS_COPY: Record<string, { title: string; message: (storeName: string) => string; icon: typeof CheckCircle2; iconColor: string; iconBg: string }> = {
  PENDING_PAYMENT: {
    title: "Order received",
    message: () => "We're finalizing your payment — this can take a moment.",
    icon: Clock,
    iconColor: "", // resolved to the template accent at render time
    iconBg: "",
  },
  CANCELLED: {
    title: "Order cancelled",
    message: (storeName) => `This order was cancelled. If you were charged, you'll be refunded — ${storeName} has been notified.`,
    icon: XCircle,
    iconColor: "#DC2626",
    iconBg: "#FEE2E2",
  },
  REFUNDED: {
    title: "Order refunded",
    message: () => "This order was refunded. It can take a few days to reflect on your statement.",
    icon: RotateCcw,
    iconColor: "#B45309",
    iconBg: "#FEF3C7",
  },
  DISPUTED: {
    title: "Order under dispute",
    message: (storeName) => `This order is being reviewed. ${storeName} and our support team have been notified.`,
    icon: AlertTriangle,
    iconColor: "#B45309",
    iconBg: "#FEF3C7",
  },
};

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const order = await getOrderForBuyer(orderId);
  if (!order) notFound();

  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.key === order.status));
  // Only these statuses represent a successfully paid order progressing
  // through fulfillment — everything else (pending, cancelled, refunded,
  // disputed) is a distinct, non-"confirmed" state.
  const isPaid = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"].includes(order.status);
  const statusInfo = STATUS_COPY[order.status];

  const violet = isVioletTemplate(order.store.template?.name);
  const marketplace = isMarketplaceTemplate(order.store.template?.name);
  const arcova = isArcovaTemplate(order.store.template?.name);
  const nova = isNovaTemplate(order.store.template?.name);
  const premium = isPremiumTemplate(order.store.template?.name);
  const accent = violet ? VIOLET.accent : marketplace ? MARKETPLACE.blue : arcova ? ARCOVA.accent : nova ? NOVA.gold : premium ? PREMIUM.accent : ACCENT;
  const ink = violet ? VIOLET.ink : marketplace ? MARKETPLACE.ink : arcova ? ARCOVA.ink : nova ? NOVA.cream : premium ? PREMIUM.ink : INK;
  const cardRadius = violet ? 20 : marketplace ? 4 : arcova ? 0 : nova ? 2 : premium ? 9 : 16;
  const cardShadow = violet ? "0 5px 20px #20144b0a" : marketplace ? "none" : arcova ? "none" : nova ? "none" : premium ? "none" : "0 1px 3px rgba(18,18,18,0.06)";
  const cardBorder = marketplace ? `1px solid ${MARKETPLACE.border}` : arcova ? `1px solid ${ARCOVA.border}` : nova ? `1px solid ${NOVA.line}` : premium ? "1px solid #e2e7e9" : "none";
  const pillRadius = violet ? 100 : marketplace ? 3 : arcova ? 0 : nova ? 2 : premium ? 20 : 8;
  const cardBg = nova ? NOVA.charcoal : "#fff";

  const StatusIcon = isPaid ? CheckCircle2 : statusInfo?.icon ?? Clock;
  const iconColor = isPaid ? "#16A34A" : statusInfo?.iconColor || accent;
  const iconBg = isPaid ? "#DCFCE7" : statusInfo?.iconBg || `${ink}0d`;
  const title = isPaid ? "Order confirmed" : statusInfo?.title ?? "Order status";
  const message = isPaid
    ? `Your payment went through. ${order.store.name} has been notified.`
    : statusInfo?.message(order.store.name) ?? "";

  const body = (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <div
        style={{ background: iconBg, borderRadius: "50%" }}
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center"
      >
        <StatusIcon className="h-8 w-8" style={{ color: iconColor }} />
      </div>
      <h1 className="mb-1 text-2xl font-extrabold">
        {title}
      </h1>
      <p style={{ opacity: 0.65 }} className="mb-8 text-sm">
        {message}
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

  if (premium) {
    const navCategories = await getStoreCategoryTree(order.storeId);
    const social = (order.store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: PREMIUM.bg, color: PREMIUM.ink, fontFamily: PREMIUM.font, fontSize: 13, minHeight: "100vh" }}>
        <PremiumHeader store={order.store} slug={slug} navCategories={navCategories} />
        {body}
        <PremiumFooter store={order.store} slug={slug} social={social} />
      </div>
    );
  }

  return (
    <div style={{ background: SURFACE, color: INK, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {body}
    </div>
  );
}
