"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, X, ArrowRight } from "lucide-react";
import { ARCOVA } from "@/lib/template-themes";

// Arcova design tokens (see lib/template-themes.ts ARCOVA) — mirrors
// violet-cart-client.tsx / marketplace-cart-client.tsx's structure but
// recolored/reshaped to match the dark editorial look, sharp square
// corners, and gold accent used across the rest of an Arcova-templated
// store.

export function ArcovaCartClient({ slug }: { slug: string }) {
  const { items, storeSlug, setQuantity, removeItem, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", fontFamily: ARCOVA.font, color: ARCOVA.ink }} className="px-6 py-10">
      <div style={{ borderBottom: `1px solid ${ARCOVA.border}` }} className="mb-8 flex items-baseline justify-between pb-4">
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0.5 }}>YOUR CART</h1>
        <span style={{ opacity: 0.6, fontSize: 12, letterSpacing: 1 }}>{itemCount} ITEM{itemCount !== 1 ? "S" : ""}</span>
      </div>

      {cartItems.length === 0 ? (
        <div style={{ border: `1px solid ${ARCOVA.border}` }} className="p-12 text-center">
          <p style={{ opacity: 0.65, fontSize: 13 }}>Your cart is empty.</p>
          <Link href={`/${slug}`} style={{ color: ARCOVA.ink, borderBottom: `1px solid ${ARCOVA.ink}` }} className="mt-3 inline-block pb-0.5 text-xs font-semibold uppercase tracking-wide no-underline hover:opacity-70">
            Continue shopping &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-8">
            {cartItems.map((item) => (
              <div
                key={item.productId}
                style={{ border: `1px solid ${ARCOVA.border}` }}
                className="flex flex-col gap-4 p-5 sm:flex-row"
              >
                <div style={{ background: "#f2f2f2" }} className="h-36 w-full flex-shrink-0 overflow-hidden sm:h-auto sm:w-36">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
                <div className="flex flex-grow flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <h3 style={{ fontSize: 15 }} className="font-semibold">{item.name}</h3>
                    <span style={{ fontSize: 15 }} className="text-right font-semibold">
                      {item.currency} {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ borderTop: `1px solid ${ARCOVA.border}` }} className="mt-3 flex items-center justify-between pt-3">
                    <div style={{ border: `1px solid ${ARCOVA.border}` }} className="flex items-center overflow-hidden">
                      <button aria-label="Decrease quantity" onClick={() => setQuantity(item.productId, item.quantity - 1)} className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-black/5">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button aria-label="Increase quantity" onClick={() => setQuantity(item.productId, item.quantity + 1)} className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-black/5">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-600 transition-colors hover:bg-red-50"
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
              style={{ background: ARCOVA.dark, color: "#fff" }}
              className="sticky top-24 flex flex-col gap-5 p-7"
            >
              <h2 style={{ fontSize: 17, letterSpacing: 0.5 }} className="font-bold uppercase">Summary</h2>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }} className="flex flex-col gap-2.5 pt-5 text-sm">
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.75 }}>Subtotal</span>
                  <span className="font-semibold">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.75 }}>Shipping</span>
                  <span style={{ opacity: 0.75 }}>Calculated next step</span>
                </div>
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }} className="flex items-end justify-between pt-5">
                <span className="text-sm font-semibold uppercase tracking-wide">Total</span>
                <span style={{ color: ARCOVA.accent }} className="text-2xl font-bold leading-none">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
              </div>
              <Link
                href={`/store/${slug}/checkout`}
                style={{ background: ARCOVA.accent, color: "#141414" }}
                className="mt-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-widest no-underline transition hover:opacity-90"
              >
                Proceed to Checkout
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p style={{ opacity: 0.45 }} className="text-center text-[11px] uppercase tracking-widest">Secure checkout</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
