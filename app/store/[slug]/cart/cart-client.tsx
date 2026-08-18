"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, X, ArrowRight } from "lucide-react";

// Lumina design tokens (see lib/template-themes.ts LUMINA) — this page sits
// outside the per-store theme (no store fetch here), so it uses the fixed
// Lumina palette directly rather than passed-in theme props.
const ACCENT = "#0041C8";
const INK = "#141D23";
const SURFACE = "#F6FAFF";
const CARD = "#FFFFFF";
const CARD_ALT = "#E6EFF8";
const INVERSE = "#293138";
const INVERSE_INK = "#E9F2FB";

export function CartClient({ slug }: { slug: string }) {
  const { items, storeSlug, setQuantity, removeItem, subtotal } = useCart();

  const cartItems = storeSlug === slug ? items : [];
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <div style={{ background: SURFACE, color: INK, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }} className="storefront-root">
      <div style={{ maxWidth: 1280 }} className="mx-auto px-6 py-14">
        <div style={{ borderBottom: `1px solid ${INK}1a` }} className="mb-8 flex items-baseline justify-between pb-4">
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-3xl font-extrabold sm:text-4xl">Your Cart</h1>
          <span style={{ opacity: 0.65 }} className="text-sm">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
        </div>

        {cartItems.length === 0 ? (
          <div style={{ background: CARD, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="p-12 text-center">
            <p style={{ opacity: 0.75 }} className="text-sm">Your cart is empty.</p>
            <Link href={`/${slug}`} style={{ color: ACCENT }} className="mt-3 inline-block text-sm font-semibold no-underline hover:opacity-80">
              Continue shopping →
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Items */}
            <div className="flex flex-col gap-4 lg:col-span-8">
              {cartItems.map((item) => (
                <div
                  key={item.productId}
                  style={{ background: CARD_ALT, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }}
                  className="flex flex-col gap-4 p-5 transition-shadow hover:shadow-md sm:flex-row"
                >
                  <div style={{ background: SURFACE, borderRadius: "0.75rem" }} className="h-40 w-full flex-shrink-0 overflow-hidden sm:h-auto sm:w-40">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                  <div className="flex flex-grow flex-col justify-between">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-lg font-semibold">{item.name}</h3>
                      </div>
                      <span className="text-right text-lg font-semibold">
                        {item.currency} {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ borderTop: `1px solid ${INK}14` }} className="mt-3 flex items-center justify-between pt-3">
                      <div style={{ background: CARD, boxShadow: "0 1px 2px rgba(18,18,18,0.08)" }} className="flex items-center overflow-hidden rounded-lg">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() => setQuantity(item.productId, item.quantity - 1)}
                          style={{ color: INK }}
                          className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-black/5"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() => setQuantity(item.productId, item.quantity + 1)}
                          style={{ color: INK }}
                          className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-black/5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="lg:col-span-4">
              <div
                style={{ background: INVERSE, color: INVERSE_INK, borderRadius: "1.25rem", boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}
                className="sticky top-24 flex flex-col gap-5 p-7"
              >
                <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-xl font-bold">Summary</h2>
                <div style={{ borderTop: `1px solid ${INVERSE_INK}22` }} className="flex flex-col gap-2.5 pt-5 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ opacity: 0.8 }}>Subtotal</span>
                    <span className="font-semibold">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ opacity: 0.8 }}>Shipping</span>
                    <span style={{ opacity: 0.8 }}>Calculated next step</span>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${INVERSE_INK}22` }} className="flex items-end justify-between pt-5">
                  <span className="text-base font-semibold">Total</span>
                  <span className="text-2xl font-extrabold leading-none">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
                </div>
                <Link
                  href={`/${slug}/checkout`}
                  style={{ background: ACCENT, color: "#fff", boxShadow: `0 8px 20px ${ACCENT}4d` }}
                  className="mt-1 flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold no-underline transition-transform hover:-translate-y-0.5"
                >
                  Proceed to Checkout
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p style={{ opacity: 0.5 }} className="text-center text-[11px] uppercase tracking-widest">Secure checkout</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
