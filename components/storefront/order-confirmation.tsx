import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { DEFAULT_STORE_PALETTE, type StorePalette } from "@/lib/store-palette-defaults";
import { formatMoney } from "@/lib/utils/format-money";

/**
 * Neutral, palette-driven order confirmation for stores that don't have a
 * dedicated confirmation skin (Grandeur = restaurants, TasteHouse, Example).
 * Mirrors the shared cart/checkout pages so the buyer stays on-brand.
 */
export function OrderConfirmation({
  slug,
  storeName,
  order,
  palette = DEFAULT_STORE_PALETTE,
}: {
  slug: string;
  storeName: string;
  order: any;
  palette?: StorePalette;
}) {
  const { accent, onAccent, ink, surface, card } = palette;
  const lines: any[] = order.items ?? [];
  return (
    <div style={{ background: surface, color: ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 720 }} className="mx-auto px-6 py-16">
        <div className="text-center">
          <CheckCircle2 size={56} style={{ color: accent }} className="mx-auto" />
          <h1 style={{ fontFamily: palette.headlineFont }} className="mt-4 text-3xl font-bold">Order confirmed</h1>
          <p className="mt-2 opacity-70">Thank you for shopping with {storeName}. Order #{String(order.id).slice(-8).toUpperCase()}</p>
        </div>
        <section style={{ background: card, border: `1px solid ${ink}14` }} className="mt-10 rounded-2xl p-6">
          {lines.map((i) => (
            <div key={i.id} className="flex justify-between gap-4 py-2 text-sm">
              <span>{i.product?.name || i.service?.name || "Item"} × {i.quantity}</span>
              <b>{formatMoney(Number(i.unitPrice) * i.quantity, order.currency)}</b>
            </div>
          ))}
          <hr style={{ borderColor: `${ink}14` }} className="my-3" />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(Number(order.total || 0), order.currency)}</span>
          </div>
        </section>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/store/${slug}/orders/${order.id}/track`} style={{ background: accent, color: onAccent }} className="rounded-full px-6 py-3 text-sm font-semibold no-underline">
            Track order
          </Link>
          <Link href={`/store/${slug}`} style={{ border: `1px solid ${ink}33`, color: ink }} className="rounded-full px-6 py-3 text-sm font-semibold no-underline">
            Continue shopping
          </Link>
        </div>
      </main>
    </div>
  );
}
