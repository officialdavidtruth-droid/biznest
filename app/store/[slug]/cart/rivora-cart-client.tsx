"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, X, ArrowRight } from "lucide-react";
import { RIVORA } from "@/lib/template-themes";

// Rivora Fresh design tokens (see lib/template-themes.ts RIVORA) — mirrors
// nova-cart-client.tsx / premium-cart-client.tsx's structure but recolored
// to the deep-green/lime grocery look and rounded 11px cards used across
// the rest of a Rivora-templated store.

export function RivoraCartClient({ slug }: { slug: string }) {
  const { items, storeSlug, setQuantity, removeItem, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", fontFamily: RIVORA.font, color: RIVORA.ink, background: "#f7f9f6", minHeight: "70vh" }} className="px-[5%] py-10">
      <div style={{ borderBottom: "1px solid #dfe8e2" }} className="mb-7 flex items-baseline justify-between pb-4">
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Your cart</h1>
        <span style={{ color: RIVORA.muted, fontSize: 12 }}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
      </div>

      {cartItems.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 11 }} className="p-12 text-center">
          <p style={{ color: RIVORA.muted, fontSize: 13 }}>Your cart is empty.</p>
          <Link href={`/${slug}`} style={{ color: RIVORA.green }} className="mt-3 inline-block text-xs font-bold no-underline hover:opacity-70">
            Continue shopping →
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-8">
            {cartItems.map((item) => (
              <div
                key={item.productId}
                style={{ background: "#fff", borderRadius: 11 }}
                className="flex flex-col gap-4 p-4 sm:flex-row"
              >
                <div style={{ background: "#f0f4f1", borderRadius: 8 }} className="h-28 w-full flex-shrink-0 overflow-hidden sm:h-24 sm:w-24">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" style={{ borderRadius: 8 }} />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
                <div className="flex flex-grow flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</h3>
                    <span style={{ fontSize: 14, fontWeight: 800 }} className="text-right whitespace-nowrap">
                      {item.currency} {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ borderTop: "1px solid #eef2ef" }} className="mt-2 flex items-center justify-between pt-2.5">
                    <div style={{ border: "1px solid #dfe8e2", borderRadius: 20 }} className="flex items-center overflow-hidden">
                      <button aria-label="Decrease quantity" onClick={() => setQuantity(item.productId, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-black/5">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span style={{ fontSize: 12 }} className="w-7 text-center font-semibold">{item.quantity}</span>
                      <button aria-label="Increase quantity" onClick={() => setQuantity(item.productId, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-black/5">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      style={{ color: "#c0392b" }}
                      className="flex items-center gap-1 text-[11px] font-bold transition-colors hover:opacity-70"
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
              style={{ background: RIVORA.deep, color: "#fff", borderRadius: 11 }}
              className="sticky top-24 flex flex-col gap-4 p-6"
            >
              <h2 style={{ fontSize: 15, fontWeight: 800 }}>Summary</h2>
              <div style={{ borderTop: "1px solid #164634" }} className="flex flex-col gap-2 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span style={{ color: "#b7c8bf" }}>Subtotal</span>
                  <span className="font-semibold">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: "#b7c8bf" }}>Delivery</span>
                  <span style={{ color: "#b7c8bf" }}>Calculated next step</span>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #164634" }} className="flex items-end justify-between pt-4">
                <span style={{ fontSize: 11, fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: RIVORA.lime }} className="leading-none">{cartItems[0]?.currency} {subtotal.toLocaleString()}</span>
              </div>
              <Link
                href={`/store/${slug}/checkout`}
                style={{ background: RIVORA.lime, color: "#153600", borderRadius: 7 }}
                className="mt-1 flex items-center justify-center gap-2 py-3.5 text-xs font-extrabold no-underline transition hover:opacity-90"
              >
                Proceed to checkout
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p style={{ color: "#8ea298" }} className="text-center text-[10px]">Secure checkout</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
