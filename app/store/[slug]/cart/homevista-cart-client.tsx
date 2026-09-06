"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, X, ArrowRight } from "lucide-react";
import { HOMEVISTA } from "@/lib/template-themes";

// HomeVista design tokens (see lib/template-themes.ts HOMEVISTA) — mirrors
// arcova-cart-client.tsx's structure but recolored/reshaped to match the
// real-estate look used across the rest of a HomeVista-templated store:
// rounded 8px cards, thin #e2e8e6 borders, dark teal summary panel, green
// accent.

export function HomeVistaCartClient({ slug }: { slug: string }) {
  const { items, storeSlug, setQuantity, removeItem, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <div style={{ width: "90%", maxWidth: 1200, margin: "0 auto", fontFamily: HOMEVISTA.font, color: HOMEVISTA.ink }} className="py-10">
      <div style={{ borderBottom: "1px solid #e2e8e6" }} className="mb-8 flex items-baseline justify-between pb-4">
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Your Cart</h1>
        <span style={{ opacity: 0.6, fontSize: 11 }}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
      </div>

      {cartItems.length === 0 ? (
        <div style={{ border: "1px solid #e2e8e6", borderRadius: 8 }} className="p-12 text-center">
          <p style={{ opacity: 0.65, fontSize: 12 }}>Your cart is empty.</p>
          <Link href={`/store/${slug}`} style={{ color: HOMEVISTA.accent, fontWeight: 700 }} className="mt-3 inline-block text-xs no-underline hover:opacity-70">
            Continue browsing &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-8">
            {cartItems.map((item) => (
              <div
                key={item.productId}
                style={{ border: "1px solid #e2e8e6", borderRadius: 8 }}
                className="flex flex-col gap-4 p-5 sm:flex-row"
              >
                <div style={{ background: "#f6faf8", borderRadius: 6 }} className="h-32 w-full flex-shrink-0 overflow-hidden sm:h-auto sm:w-32">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
                <div className="flex flex-grow flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <h3 style={{ fontSize: 13 }} className="font-bold">{item.name}</h3>
                    <span style={{ fontSize: 13, color: HOMEVISTA.accent }} className="text-right font-bold">
                      {item.currency} {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ borderTop: "1px solid #edf0ef" }} className="mt-3 flex items-center justify-between pt-3">
                    <div style={{ border: "1px solid #e2e8e6", borderRadius: 6 }} className="flex items-center overflow-hidden">
                      <button aria-label="Decrease quantity" onClick={() => setQuantity(item.productId, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-black/5">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-semibold">{item.quantity}</span>
                      <button aria-label="Increase quantity" onClick={() => setQuantity(item.productId, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-black/5">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      style={{ borderRadius: 6 }}
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
              style={{ background: HOMEVISTA.dark, color: "#fff", borderRadius: 8 }}
              className="sticky top-24 flex flex-col gap-5 p-7"
            >
              <h2 style={{ fontSize: 15 }} className="font-bold">Summary</h2>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }} className="flex flex-col gap-2.5 pt-5 text-sm">
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.75, fontSize: 12 }}>Subtotal</span>
                  <span className="text-sm font-semibold">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.75, fontSize: 12 }}>Delivery</span>
                  <span style={{ opacity: 0.75, fontSize: 12 }}>Calculated next step</span>
                </div>
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }} className="flex items-end justify-between pt-5">
                <span className="text-sm font-semibold">Total</span>
                <span style={{ color: "#5cd39a" }} className="text-2xl font-bold leading-none">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
              </div>
              <Link
                href={`/store/${slug}/checkout`}
                style={{ background: HOMEVISTA.accent, color: "#fff", borderRadius: 7 }}
                className="mt-1 flex items-center justify-center gap-2 py-3 text-xs font-bold no-underline transition hover:opacity-90"
              >
                Proceed to Checkout
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p style={{ opacity: 0.45, fontSize: 10 }} className="text-center">Secure checkout</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
