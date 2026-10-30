import Link from "next/link";
import { Clock, XCircle, RotateCcw, ShieldAlert } from "lucide-react";
import type { StorePalette } from "@/lib/store-palette-defaults";
import { OrderStatusPoller } from "@/components/storefront/order-status-poller";

type NoticeStatus = "PENDING_PAYMENT" | "CANCELLED" | "REFUNDED" | "DISPUTED";

export const NOTICE_STATUSES: readonly string[] = ["PENDING_PAYMENT", "CANCELLED", "REFUNDED", "DISPUTED"];

/**
 * Shown instead of the "Order confirmed" screen when an order is NOT in a
 * paid/fulfilled state. Skin-independent on purpose: every confirmation skin
 * (default, TasteHouse, Grandeur, Example) is only rendered for paid orders.
 */
export function OrderStatusNotice({
  slug,
  storeName,
  orderCode,
  status,
  palette,
  contactEmail,
  contactPhone,
}: {
  slug: string;
  storeName: string;
  orderCode: string;
  status: NoticeStatus;
  palette: StorePalette;
  contactEmail?: string | null;
  contactPhone?: string | null;
}) {
  const { accent, onAccent, ink, surface, card } = palette;
  const contact = [contactEmail, contactPhone].filter(Boolean).join(" · ");
  const contactLine = contact ? ` You can reach them on ${contact}.` : "";

  const copy: Record<NoticeStatus, { Icon: typeof Clock; title: string; body: string }> = {
    PENDING_PAYMENT: {
      Icon: Clock,
      title: "Confirming your payment",
      body: `We're waiting for confirmation of your payment to ${storeName}. This usually takes a few seconds. Please don't pay again.`,
    },
    CANCELLED: {
      Icon: XCircle,
      title: "This order was cancelled",
      body: `No order is going ahead for this payment. If you were charged, please contact ${storeName} about a refund.${contactLine}`,
    },
    REFUNDED: {
      Icon: RotateCcw,
      title: "This order was refunded",
      body: `Your refund has been issued. It can take a few business days to show in your account. If it doesn't, contact ${storeName}.${contactLine}`,
    },
    DISPUTED: {
      Icon: ShieldAlert,
      title: "This order is under review",
      body: "A dispute is open for this order. You can follow its progress from your orders.",
    },
  };

  const { Icon, title, body } = copy[status];

  return (
    <div style={{ background: surface, color: ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 720 }} className="mx-auto px-6 py-16">
        <div className="text-center">
          <Icon size={56} style={{ color: accent }} className="mx-auto" aria-hidden />
          <h1 style={{ fontFamily: palette.headlineFont }} className="mt-4 text-3xl font-bold">{title}</h1>
          <p className="mt-2 opacity-70">Order #{orderCode} · {storeName}</p>
        </div>
        <section style={{ background: card, border: `1px solid ${ink}14` }} className="mt-10 rounded-2xl p-6 text-sm leading-relaxed">
          {body}
        </section>
        {status === "PENDING_PAYMENT" && (
          <div className="text-center">
            <OrderStatusPoller />
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {status !== "PENDING_PAYMENT" && (
            <Link href={`/store/${slug}/orders`} style={{ background: accent, color: onAccent }} className="rounded-full px-6 py-3 text-sm font-semibold no-underline">
              My orders
            </Link>
          )}
          <Link
            href={`/store/${slug}`}
            style={status === "PENDING_PAYMENT" ? { background: accent, color: onAccent } : { border: `1px solid ${ink}33`, color: ink }}
            className="rounded-full px-6 py-3 text-sm font-semibold no-underline"
          >
            Continue shopping
          </Link>
        </div>
      </main>
    </div>
  );
}
