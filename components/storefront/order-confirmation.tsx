import Link from "next/link";
import { formatShipsOn } from "@/lib/preorder";
import { DEFAULT_STORE_PALETTE, type StorePalette } from "@/lib/store-palette-defaults";
import { formatMoney } from "@/lib/utils/format-money";

/**
 * Neutral, palette-driven order confirmation for stores that don't have a
 * dedicated confirmation skin (Grandeur = restaurants, TasteHouse, Example).
 * Mirrors the shared cart/checkout pages so the buyer stays on-brand.
 *
 * Laid out as a receipt: the buyer lands on something they can screenshot or
 * keep -- order number, date, each line, and a clear total.
 */
const CSS = `
.oc-check-ring{stroke-dasharray:176;stroke-dashoffset:176;animation:oc-draw .7s cubic-bezier(.65,0,.35,1) .1s forwards}
.oc-check-tick{stroke-dasharray:40;stroke-dashoffset:40;animation:oc-draw .4s cubic-bezier(.65,0,.35,1) .7s forwards}
.oc-halo{animation:oc-halo 1.1s ease-out .7s both}
.oc-receipt{animation:oc-rise .6s cubic-bezier(.2,.7,.2,1) .55s both}
@keyframes oc-draw{to{stroke-dashoffset:0}}
@keyframes oc-halo{from{transform:scale(.7);opacity:.9}to{transform:scale(1.6);opacity:0}}
@keyframes oc-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.oc-btn{transition:transform .15s ease,box-shadow .15s ease,background-color .15s ease}
.oc-btn:hover{transform:translateY(-1px)}
.oc-btn:focus-visible{outline:2px solid currentColor;outline-offset:3px}
@media (prefers-reduced-motion:reduce){
  .oc-check-ring,.oc-check-tick{animation:none;stroke-dashoffset:0}
  .oc-halo{animation:none;opacity:0}
  .oc-receipt{animation:none}
  .oc-btn{transition:none}
  .oc-btn:hover{transform:none}
}
`;

function formatOrderDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
}

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
  const code = String(order.id).slice(-8).toUpperCase();
  const placedOn = formatOrderDate(order.createdAt);
  const itemCount = lines.reduce((n, i) => n + (Number(i.quantity) || 0), 0);

  // Itemised breakdown. Anything between the lines + delivery and the stored
  // total (a discount, a gift card, a fee) is shown as one honest row instead
  // of leaving the numbers not adding up.
  const linesTotal = lines.reduce((n, i) => n + Number(i.unitPrice) * Number(i.quantity), 0);
  const delivery = Number(order.deliveryFee || 0);
  const total = Number(order.total || 0);
  const adjustment = Math.round((total - linesTotal - delivery) * 100) / 100;
  const showBreakdown = delivery > 0 || Math.abs(adjustment) >= 0.01;

  const hairline = `${ink}14`;
  const muted = `${ink}99`;

  return (
    <div style={{ background: surface, color: ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main style={{ maxWidth: 560 }} className="mx-auto px-5 pb-16 pt-14 sm:pt-20">
        <header className="text-center">
          <div className="relative mx-auto" style={{ width: 72, height: 72 }}>
            <span className="oc-halo absolute inset-0 rounded-full" style={{ background: `${accent}33` }} aria-hidden="true" />
            <svg viewBox="0 0 72 72" width="72" height="72" className="relative" aria-hidden="true" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="36" cy="36" r="28" className="oc-check-ring" transform="rotate(-90 36 36)" />
              <path d="M25 37.5l8 8 15-17" className="oc-check-tick" />
            </svg>
          </div>
          <h1 style={{ fontFamily: palette.headlineFont, letterSpacing: "-0.02em" }} className="mt-6 text-3xl font-bold sm:text-4xl">
            Order confirmed
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed" style={{ color: muted }}>
            Thank you for shopping with {storeName}. Keep this page for your records.
          </p>
        </header>

        <section
          className="oc-receipt mt-10 overflow-hidden rounded-3xl"
          style={{ background: card, border: `1px solid ${hairline}`, boxShadow: `0 1px 2px ${ink}0d, 0 12px 32px -12px ${ink}26` }}
          aria-label={`Receipt for order ${code}`}
        >
          <div style={{ height: 4, background: accent }} aria-hidden="true" />

          <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-6">
            <div>
              <p className="text-xs" style={{ color: muted }}>Order number</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-wide">#{code}</p>
            </div>
            {placedOn && (
              <div className="text-right">
                <p className="text-xs" style={{ color: muted }}>Placed on</p>
                <p className="mt-1 text-sm font-medium">{placedOn}</p>
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px dashed ${ink}2e` }} />

          <ul className="px-6 py-3">
            {lines.map((i, idx) => {
              const name = i.product?.name || i.service?.name || "Item";
              return (
                <li
                  key={i.id}
                  className="flex items-start justify-between gap-4 py-3"
                  style={idx > 0 ? { borderTop: `1px solid ${hairline}` } : undefined}
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium leading-snug">{name}</p>
                    <p className="mt-0.5 text-sm tabular-nums" style={{ color: muted }}>
                      Qty {i.quantity} · {formatMoney(Number(i.unitPrice), order.currency)} each
                    </p>
                    {i.preorder && (
                      <p className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: `${accent}14`, color: accent }}>
                        Pre-order{i.preorderShipsOn ? ` · ships by ${formatShipsOn(i.preorderShipsOn)}` : ""}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-[15px] font-semibold tabular-nums">
                    {formatMoney(Number(i.unitPrice) * Number(i.quantity), order.currency)}
                  </p>
                </li>
              );
            })}
          </ul>

          <div style={{ borderTop: `1px dashed ${ink}2e` }} />

          <div className="px-6 pb-6 pt-5">
            {showBreakdown && (
              <dl className="mb-4 space-y-2 text-sm tabular-nums" style={{ color: muted }}>
                <div className="flex justify-between gap-4">
                  <dt>Items ({itemCount})</dt>
                  <dd>{formatMoney(linesTotal, order.currency)}</dd>
                </div>
                {delivery > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt>Delivery</dt>
                    <dd>{formatMoney(delivery, order.currency)}</dd>
                  </div>
                )}
                {Math.abs(adjustment) >= 0.01 && (
                  <div className="flex justify-between gap-4">
                    <dt>{adjustment < 0 ? "Discounts applied" : "Fees and other charges"}</dt>
                    <dd>{adjustment < 0 ? "−" : ""}{formatMoney(Math.abs(adjustment), order.currency)}</dd>
                  </div>
                )}
              </dl>
            )}
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium" style={{ color: muted }}>Total paid</span>
              <span style={{ fontFamily: palette.headlineFont, letterSpacing: "-0.02em" }} className="text-3xl font-bold tabular-nums">
                {formatMoney(total, order.currency)}
              </span>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/store/${slug}/orders`}
            style={{ background: accent, color: onAccent, boxShadow: `0 8px 20px -8px ${accent}99` }}
            className="oc-btn rounded-full px-7 py-3.5 text-center text-sm font-semibold no-underline"
          >
            View my orders
          </Link>
          <Link
            href={`/store/${slug}`}
            style={{ border: `1px solid ${ink}33`, color: ink }}
            className="oc-btn rounded-full px-7 py-3.5 text-center text-sm font-semibold no-underline"
          >
            Continue shopping
          </Link>
        </div>
      </main>
    </div>
  );
}
