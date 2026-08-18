"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, X, ArrowRight } from "lucide-react";
import { RRW } from "@/lib/template-themes";

// rRW design tokens (see lib/template-themes.ts RRW) — mirrors
// homevista-cart-client.tsx's structure but recolored/reshaped to match
// the rRW homepage/nav: sharp 3px corners, dark #080a0d summary panel,
// pill-shaped buttons, blue accent.

export function RrwCartClient({ slug }: { slug: string }) {
  const { items, storeSlug, setQuantity, removeItem, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <div style={{ padding: "32px 6% 60px", fontFamily: RRW.font, color: RRW.ink }}>
      <div style={{ borderBottom: "1px solid #ddd" }} className="mb-8 flex items-baseline justify-between pb-4">
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: 0 }}>Your Cart</h1>
        <span style={{ opacity: 0.55, fontSize: 10 }}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
      </div>

      {cartItems.length === 0 ? (
        <div style={{ border: "1px solid #ddd" }} className="p-12 text-center">
          <p style={{ opacity: 0.6, fontSize: 11 }}>Your cart is empty.</p>
          <Link href={`/${slug}`} style={{ color: RRW.ink, fontWeight: 700, borderBottom: `1px solid ${RRW.ink}` }} className="mt-3 inline-block pb-0.5 text-xs no-underline hover:opacity-70">
            Continue browsing &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-0 border border-[#ddd] lg:col-span-8">
            {cartItems.map((item, i) => (
              <div
                key={item.productId}
                style={{ borderTop: i === 0 ? "none" : "1px solid #ddd" }}
                className="flex flex-col gap-4 p-5 sm:flex-row"
              >
                <div style={{ background: "#f4f5f6" }} className="h-32 w-full flex-shrink-0 overflow-hidden sm:h-auto sm:w-32">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
                <div className="flex flex-grow flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <h3 style={{ fontSize: 13 }} className="font-bold">{item.name}</h3>
                    <span style={{ fontSize: 13 }} className="text-right font-bold">
                      {item.currency} {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ borderTop: "1px solid #eee" }} className="mt-3 flex items-center justify-between pt-3">
                    <div style={{ border: "1px solid #ddd", borderRadius: 20 }} className="flex items-center overflow-hidden">
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
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
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
              style={{ background: "#080a0d", color: "#fff" }}
              className="sticky top-24 flex flex-col gap-5 p-7"
            >
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Summary</h2>
              <div style={{ borderTop: "1px solid #292b2e" }} className="flex flex-col gap-2.5 pt-5 text-sm">
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.65, fontSize: 11 }}>Subtotal</span>
                  <span className="text-sm font-semibold">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.65, fontSize: 11 }}>Delivery</span>
                  <span style={{ opacity: 0.65, fontSize: 11 }}>Calculated next step</span>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #292b2e" }} className="flex items-end justify-between pt-5">
                <span className="text-sm font-semibold">Total</span>
                <span style={{ color: RRW.accent }} className="text-2xl font-bold leading-none">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
              </div>
              <Link
                href={`/store/${slug}/checkout`}
                style={{ background: RRW.accent, color: "#fff", borderRadius: 20 }}
                className="mt-1 flex items-center justify-center gap-2 py-3 text-xs font-bold no-underline transition hover:opacity-90"
              >
                Proceed to Checkout
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p style={{ opacity: 0.4, fontSize: 9 }} className="text-center">Secure checkout</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
