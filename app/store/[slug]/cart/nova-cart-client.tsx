"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, X, ArrowRight } from "lucide-react";
import { NOVA } from "@/lib/template-themes";

// Nova design tokens (see lib/template-themes.ts NOVA) — mirrors
// arcova-cart-client.tsx / violet-cart-client.tsx's structure but recolored
// to the dark editorial black/cream/gold look and serif display type used
// across the rest of a Nova-templated store.

const serif = { fontFamily: NOVA.headlineFont } as const;
const label = { fontFamily: "monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: NOVA.gold };

export function NovaCartClient({ slug }: { slug: string }) {
  const { items, storeSlug, setQuantity, removeItem, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", fontFamily: NOVA.font, color: NOVA.cream, background: NOVA.black, minHeight: "70vh" }} className="px-6 py-10">
      <div style={{ borderBottom: `1px solid ${NOVA.line}` }} className="mb-8 flex items-baseline justify-between pb-5">
        <h1 style={{ ...serif, fontSize: 30, fontWeight: 700 }}>Your Cart</h1>
        <span style={label}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
      </div>

      {cartItems.length === 0 ? (
        <div style={{ border: `1px solid ${NOVA.line}` }} className="p-14 text-center">
          <p style={{ color: NOVA.gray, fontSize: 13 }}>Your cart is empty.</p>
          <Link href={`/store/${slug}`} style={{ ...label, color: NOVA.cream, borderBottom: `1px solid ${NOVA.line}` }} className="mt-4 inline-block pb-1 no-underline hover:opacity-70">
            Continue shopping →
          </Link>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="flex flex-col lg:col-span-8">
            {cartItems.map((item, i) => (
              <div
                key={item.productId}
                style={{ borderTop: i === 0 ? `1px solid ${NOVA.line}` : "none", borderBottom: `1px solid ${NOVA.line}` }}
                className="flex flex-col gap-5 py-6 sm:flex-row"
              >
                <div style={{ background: NOVA.charcoal, border: `1px solid ${NOVA.line}` }} className="h-36 w-full flex-shrink-0 overflow-hidden sm:h-28 sm:w-28">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
                <div className="flex flex-grow flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <h3 style={{ ...serif, fontSize: 18, fontWeight: 700 }}>{item.name}</h3>
                    <span style={{ ...serif, fontSize: 16, color: NOVA.gold }} className="text-right whitespace-nowrap">
                      {item.currency} {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div style={{ border: `1px solid ${NOVA.line}` }} className="flex items-center overflow-hidden">
                      <button aria-label="Decrease quantity" onClick={() => setQuantity(item.productId, item.quantity - 1)} style={{ color: NOVA.cream }} className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-white/5">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span style={{ fontSize: 13 }} className="w-8 text-center font-medium">{item.quantity}</span>
                      <button aria-label="Increase quantity" onClick={() => setQuantity(item.productId, item.quantity + 1)} style={{ color: NOVA.cream }} className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-white/5">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      style={{ ...label, color: "#e07a5f" }}
                      className="flex items-center gap-1.5 px-3 py-2 transition-colors hover:opacity-75"
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-4">
            <div
              style={{ background: NOVA.charcoal, border: `1px solid ${NOVA.line}` }}
              className="sticky top-24 flex flex-col gap-5 p-7"
            >
              <h2 style={{ ...serif, fontSize: 18, fontWeight: 700 }}>Summary</h2>
              <div style={{ borderTop: `1px solid ${NOVA.line}` }} className="flex flex-col gap-2.5 pt-5 text-sm">
                <div className="flex items-center justify-between">
                  <span style={{ color: NOVA.gray }}>Subtotal</span>
                  <span className="font-semibold">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: NOVA.gray }}>Shipping</span>
                  <span style={{ color: NOVA.gray }}>Calculated next step</span>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${NOVA.line}` }} className="flex items-end justify-between pt-5">
                <span style={label}>Total</span>
                <span style={{ ...serif, color: NOVA.gold }} className="text-2xl font-bold leading-none">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
              </div>
              <Link
                href={`/store/${slug}/checkout`}
                style={{ background: NOVA.gold, color: NOVA.black }}
                className="mt-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-widest no-underline transition hover:opacity-90"
              >
                Proceed to Checkout
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p style={{ color: NOVA.gray }} className="text-center text-[11px] uppercase tracking-widest">Secure checkout</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
