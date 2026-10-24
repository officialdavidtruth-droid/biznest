"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, Trash2, ArrowRight, ArrowLeft, ShieldCheck, Truck, ShoppingBag, Check } from "lucide-react";
import { DEFAULT_STORE_PALETTE, type StorePalette } from "@/lib/store-palette-defaults";
import { formatMoney } from "@/lib/utils/format-money";

export function CartClient({
  slug,
  storeName,
  logoUrl,
  palette = DEFAULT_STORE_PALETTE,
}: {
  slug: string;
  storeName?: string;
  logoUrl?: string | null;
  palette?: StorePalette;
}) {
  const ACCENT = palette.accent, INK = palette.ink, SURFACE = palette.surface, CARD = palette.card, CARD_ALT = palette.cardAlt, INVERSE = palette.inverse, INVERSE_INK = palette.inverseInk;
  const { items, storeSlug, setQuantity, removeItem, clear, subtotal } = useCart();

  const cartItems = storeSlug === slug ? items : [];
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);
  const currency = cartItems[0]?.currency;
  const total = formatMoney(subtotal, currency);

  const steps = [
    { label: "Cart", active: true },
    { label: "Checkout", active: false },
    { label: "Confirmation", active: false },
  ];

  return (
    <div style={{ background: SURFACE, color: INK, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      {/* Store bar: the cart used to be an unbranded page with no way back */}
      <header style={{ background: CARD, borderBottom: `1px solid ${INK}14` }}>
        <div style={{ maxWidth: 1280 }} className="mx-auto flex items-center justify-between gap-4 px-6 py-4">
          <Link href={`/store/${slug}`} className="flex items-center gap-3 no-underline" style={{ color: INK }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={storeName ?? "Store"} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <span style={{ background: ACCENT, color: palette.onAccent }} className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold">
                {(storeName ?? "S").charAt(0).toUpperCase()}
              </span>
            )}
            <span style={{ fontFamily: palette.headlineFont }} className="text-base font-bold">{storeName ?? "Store"}</span>
          </Link>
          <Link href={`/store/${slug}`} style={{ color: INK }} className="flex items-center gap-1.5 text-sm font-medium no-underline opacity-75 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Continue shopping</span>
            <span className="sm:hidden">Shop</span>
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 1280 }} className="mx-auto px-6 pb-32 pt-10 lg:pb-14">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 style={{ fontFamily: palette.headlineFont }} className="text-3xl font-extrabold sm:text-4xl">Your Cart</h1>
            <p style={{ opacity: 0.65 }} className="mt-1 text-sm">{itemCount} item{itemCount !== 1 ? "s" : ""} ready to order</p>
          </div>
          <ol className="flex items-center gap-2 text-xs font-semibold" aria-label="Checkout progress">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2">
                <span
                  style={s.active ? { background: ACCENT, color: palette.onAccent } : { background: `${INK}12`, color: INK, opacity: 0.6 }}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px]"
                >
                  {i + 1}
                </span>
                <span style={{ opacity: s.active ? 1 : 0.55 }}>{s.label}</span>
                {i < steps.length - 1 && <span style={{ background: `${INK}22` }} className="mx-1 h-px w-6" />}
              </li>
            ))}
          </ol>
        </div>

        {cartItems.length === 0 ? (
          <div style={{ background: CARD, borderRadius: "1.25rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="flex flex-col items-center p-14 text-center">
            <span style={{ background: `${ACCENT}1a`, color: ACCENT }} className="mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <ShoppingBag className="h-7 w-7" />
            </span>
            <h2 style={{ fontFamily: palette.headlineFont }} className="text-xl font-bold">Your cart is empty</h2>
            <p style={{ opacity: 0.7 }} className="mt-1 max-w-sm text-sm">Looks like you haven’t added anything yet. Browse the store and add what you like.</p>
            <Link
              href={`/store/${slug}`}
              style={{ background: ACCENT, color: palette.onAccent }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold no-underline hover:opacity-90"
            >
              Start shopping <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Items */}
            <div className="flex flex-col gap-4 lg:col-span-8">
              {cartItems.map((item) => (
                <div
                  key={`${item.productId}:${item.variantId ?? "base"}`}
                  style={{ background: CARD_ALT, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }}
                  className="flex gap-4 p-4 transition-shadow hover:shadow-md sm:p-5"
                >
                  <div style={{ background: SURFACE, borderRadius: "0.75rem" }} className="h-24 w-24 flex-shrink-0 overflow-hidden sm:h-32 sm:w-32">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div style={{ color: INK }} className="flex h-full w-full items-center justify-center opacity-25"><ShoppingBag className="h-8 w-8" /></div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 style={{ fontFamily: palette.headlineFont }} className="truncate text-base font-semibold sm:text-lg">{item.name}</h3>
                        {item.variantLabel && <p className="mt-0.5 text-xs opacity-65">{item.variantLabel}</p>}
                        <p className="mt-1 text-xs opacity-60">{formatMoney(item.price, item.currency)} each</p>
                      </div>
                      <span className="whitespace-nowrap text-base font-bold sm:text-lg">{formatMoney(item.price * item.quantity, item.currency)}</span>
                    </div>

                    <div style={{ borderTop: `1px solid ${INK}14` }} className="flex items-center justify-between pt-3">
                      <div style={{ background: CARD, boxShadow: "0 1px 2px rgba(18,18,18,0.08)" }} className="flex items-center overflow-hidden rounded-lg">
                        <button
                          aria-label={`Decrease quantity of ${item.name}`}
                          onClick={() => (item.quantity <= 1 ? removeItem(item.productId, item.variantId) : setQuantity(item.productId, item.quantity - 1, item.variantId))}
                          style={{ color: INK }}
                          className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-black/5"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span aria-live="polite" className="w-9 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          aria-label={`Increase quantity of ${item.name}`}
                          onClick={() => setQuantity(item.productId, item.quantity + 1, item.variantId)}
                          style={{ color: INK }}
                          className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-black/5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-1 text-sm">
                <Link href={`/store/${slug}`} style={{ color: ACCENT }} className="flex items-center gap-1.5 font-semibold no-underline hover:opacity-80">
                  <ArrowLeft className="h-4 w-4" /> Continue shopping
                </Link>
                <button onClick={() => clear()} style={{ color: INK }} className="text-xs font-medium underline opacity-60 hover:opacity-100">
                  Clear cart
                </button>
              </div>
            </div>

            {/* Summary */}
            <aside className="lg:col-span-4">
              <div
                style={{ background: INVERSE, color: INVERSE_INK, borderRadius: "1.25rem", boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}
                className="sticky top-6 flex flex-col gap-5 p-7"
              >
                <h2 style={{ fontFamily: palette.headlineFont }} className="text-xl font-bold">Order summary</h2>
                <div style={{ borderTop: `1px solid ${INVERSE_INK}22` }} className="flex flex-col gap-2.5 pt-5 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ opacity: 0.8 }}>Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})</span>
                    <span className="font-semibold">{total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ opacity: 0.8 }}>Shipping</span>
                    <span style={{ opacity: 0.8 }}>Calculated at checkout</span>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${INVERSE_INK}22` }} className="flex items-end justify-between pt-5">
                  <span className="text-base font-semibold">Total</span>
                  <span className="text-2xl font-extrabold leading-none">{total}</span>
                </div>
                <Link
                  href={`/store/${slug}/checkout`}
                  style={{ background: ACCENT, color: palette.onAccent, boxShadow: `0 8px 20px ${ACCENT}4d` }}
                  className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold no-underline transition-transform hover:-translate-y-0.5"
                >
                  Proceed to Checkout
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <ul style={{ borderTop: `1px solid ${INVERSE_INK}22`, opacity: 0.8 }} className="flex flex-col gap-2 pt-5 text-xs">
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0" /> Secure, encrypted payment</li>
                  <li className="flex items-center gap-2"><Truck className="h-4 w-4 shrink-0" /> Delivery cost shown before you pay</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0" /> Review your order before confirming</li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Mobile sticky checkout bar */}
      {cartItems.length > 0 && (
        <div style={{ background: CARD, borderTop: `1px solid ${INK}14`, boxShadow: "0 -8px 24px rgba(0,0,0,0.08)" }} className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 px-5 py-3 lg:hidden">
          <div>
            <p className="text-[11px] uppercase tracking-wider opacity-60">Total</p>
            <p className="text-lg font-extrabold leading-tight">{total}</p>
          </div>
          <Link
            href={`/store/${slug}/checkout`}
            style={{ background: ACCENT, color: palette.onAccent }}
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold no-underline"
          >
            Checkout <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
