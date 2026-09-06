"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, X, ArrowRight } from "lucide-react";
import { FABTEX } from "@/lib/template-themes";

// Fabtex design tokens (see lib/template-themes.ts FABTEX) — mirrors
// rivora-cart-client.tsx's structure but recolored to the dark
// industrial / sharp-corner / letter-spaced look used across the rest
// of a Fabtex-templated store.

export function FabtexCartClient({ slug }: { slug: string }) {
  const { items, storeSlug, setQuantity, removeItem, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", fontFamily: FABTEX.font, color: "#fff", background: FABTEX.dark, minHeight: "70vh" }} className="px-[7%] py-10">
      <div style={{ borderBottom: "1px solid #343131" }} className="mb-7 flex items-baseline justify-between pb-4">
        <h1 style={{ fontSize: 24, fontWeight: 400, letterSpacing: 3 }}>YOUR CART</h1>
        <span style={{ color: FABTEX.muted, fontSize: 11 }}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
      </div>

      {cartItems.length === 0 ? (
        <div style={{ background: FABTEX.panel, border: "1px solid #393535" }} className="p-12 text-center">
          <p style={{ color: FABTEX.muted, fontSize: 12 }}>Your cart is empty.</p>
          <Link href={`/store/${slug}`} style={{ color: FABTEX.orange }} className="mt-3 inline-block text-[11px] font-bold uppercase tracking-wide no-underline hover:opacity-70">
            Continue shopping →
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-8">
            {cartItems.map((item) => (
              <div
                key={item.productId}
                style={{ background: FABTEX.panel, border: "1px solid #393535" }}
                className="flex flex-col gap-4 p-4 sm:flex-row"
              >
                <div style={{ background: "#181616" }} className="h-28 w-full flex-shrink-0 overflow-hidden sm:h-24 sm:w-24">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
                <div className="flex flex-grow flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <h3 style={{ fontSize: 13, fontWeight: 400 }}>{item.name}</h3>
                    <span style={{ fontSize: 13, fontWeight: 700, color: FABTEX.orange }} className="text-right whitespace-nowrap">
                      {item.currency} {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ borderTop: "1px solid #343131" }} className="mt-2 flex items-center justify-between pt-2.5">
                    <div style={{ border: "1px solid #393535" }} className="flex items-center overflow-hidden">
                      <button aria-label="Decrease quantity" onClick={() => setQuantity(item.productId, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-white/5">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span style={{ fontSize: 12 }} className="w-7 text-center font-semibold">{item.quantity}</span>
                      <button aria-label="Increase quantity" onClick={() => setQuantity(item.productId, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-white/5">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      style={{ color: "#e0674a" }}
                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide transition-colors hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-4">
            <div
              style={{ background: FABTEX.black, color: "#fff", border: "1px solid #2c2929" }}
              className="sticky top-24 flex flex-col gap-4 p-6"
            >
              <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>SUMMARY</h2>
              <div style={{ borderTop: "1px solid #2c2929" }} className="flex flex-col gap-2 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span style={{ color: FABTEX.muted }}>Subtotal</span>
                  <span className="font-semibold">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: FABTEX.muted }}>Delivery</span>
                  <span style={{ color: FABTEX.muted }}>Calculated next step</span>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #2c2929" }} className="flex items-end justify-between pt-4">
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>TOTAL</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: FABTEX.orange }} className="leading-none">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
              </div>
              <Link
                href={`/store/${slug}/checkout`}
                style={{ background: FABTEX.orange, color: "#fff" }}
                className="mt-1 flex items-center justify-center gap-2 py-3.5 text-[11px] font-bold uppercase tracking-wide no-underline transition hover:opacity-90"
              >
                Proceed to checkout
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p style={{ color: "#777" }} className="text-center text-[10px]">Secure checkout</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
