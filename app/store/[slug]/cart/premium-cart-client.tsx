"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, X, ArrowRight } from "lucide-react";
import { PREMIUM } from "@/lib/template-themes";

// Premium Marketplace design tokens (see lib/template-themes.ts PREMIUM) —
// mirrors marketplace-cart-client.tsx's structure but recolored/reshaped to
// match the rounded cards, muted panel background, and dark footer accents
// used across the rest of a Premium-templated store.

export function PremiumCartClient({ slug }: { slug: string }) {
  const { items, storeSlug, setQuantity, removeItem, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <div style={{ width: "90%", maxWidth: 1200, margin: "0 auto", fontFamily: PREMIUM.font, color: PREMIUM.ink, fontSize: 13 }} className="px-2 py-8">
      <div style={{ borderBottom: "1px solid #e2e7e9" }} className="mb-6 flex items-baseline justify-between pb-3">
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Your Cart</h1>
        <span style={{ opacity: 0.6, fontSize: 12 }}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
      </div>

      {cartItems.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e2e7e9", borderRadius: PREMIUM.radius }} className="p-10 text-center">
          <p style={{ opacity: 0.7, fontSize: 13 }}>Your cart is empty.</p>
          <Link href={`/${slug}`} style={{ color: PREMIUM.accent, fontSize: 13 }} className="mt-3 inline-block font-semibold no-underline hover:opacity-80">
            Continue shopping →
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-8">
            {cartItems.map((item) => (
              <div
                key={item.productId}
                style={{ background: "#fff", border: "1px solid #e2e7e9", borderRadius: PREMIUM.radius }}
                className="flex flex-col gap-4 p-4 sm:flex-row"
              >
                <div style={{ background: "#f0f3f4", borderRadius: 5 }} className="h-32 w-full flex-shrink-0 overflow-hidden sm:h-auto sm:w-32">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
                <div className="flex flex-grow flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <h3 style={{ fontSize: 13.5, fontWeight: 700 }}>{item.name}</h3>
                    <span style={{ fontSize: 13.5, fontWeight: 900 }}>
                      {item.currency} {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ borderTop: "1px solid #e2e7e9" }} className="mt-3 flex items-center justify-between pt-3">
                    <div style={{ border: "1px solid #e2e7e9", borderRadius: 6 }} className="flex items-center overflow-hidden">
                      <button aria-label="Decrease quantity" onClick={() => setQuantity(item.productId, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-black/5">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                      <button aria-label="Increase quantity" onClick={() => setQuantity(item.productId, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-black/5">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      style={{ color: "#c0392b" }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors hover:bg-red-50"
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
              style={{ background: "#1e2429", color: "#fff", borderRadius: PREMIUM.radius }}
              className="sticky top-24 flex flex-col gap-4 p-6"
            >
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Summary</h2>
              <div style={{ borderTop: "1px solid #ffffff22" }} className="flex flex-col gap-2 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.8 }}>Subtotal</span>
                  <span className="font-semibold">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.8 }}>Shipping</span>
                  <span style={{ opacity: 0.8 }}>Calculated next step</span>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #ffffff22" }} className="flex items-end justify-between pt-4">
                <span style={{ fontSize: 13 }} className="font-semibold">Total</span>
                <span style={{ fontSize: 19 }} className="font-extrabold leading-none">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
              </div>
              <Link
                href={`/store/${slug}/checkout`}
                style={{ background: PREMIUM.accent, color: "#fff", borderRadius: 20 }}
                className="mt-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wide no-underline transition hover:opacity-90"
              >
                Proceed to Checkout
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <p style={{ opacity: 0.5 }} className="text-center text-[10px] uppercase tracking-widest">Secure checkout</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
