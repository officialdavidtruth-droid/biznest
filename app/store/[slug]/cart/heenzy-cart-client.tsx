"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, X, ArrowRight } from "lucide-react";

export function HeenzyCartClient({ slug }: { slug: string }) {
  const { items, storeSlug, setQuantity, removeItem, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="hz-root" style={{ minHeight: "100vh" }}>
      <div className="hz-wrap" style={{ paddingTop: 48, paddingBottom: 64 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "1px solid #e7e7e7", paddingBottom: 16, marginBottom: 28 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Your Cart</h1>
          <span style={{ color: "#6b6b6b", fontSize: 14 }}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
        </div>

        {cartItems.length === 0 ? (
          <div style={{ background: "#f7f7f7", borderRadius: 14, padding: 48, textAlign: "center" }}>
            <p style={{ color: "#6b6b6b", fontSize: 14 }}>Your cart is empty.</p>
            <Link href={`/${slug}`} className="hz-btn hz-btn-dark" style={{ marginTop: 14 }}>Continue shopping</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 32, gridTemplateColumns: "1.6fr 1fr" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {cartItems.map((item) => (
                <div key={item.productId} className="hz-cart-row">
                  {item.image ? <img src={item.image} alt={item.name} /> : <div style={{ width: 84, height: 84, borderRadius: 10, background: "#f7f7f7" }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{item.name}</h3>
                      <span style={{ fontWeight: 800 }}>{item.currency} {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                      <div className="hz-qty-control">
                        <button aria-label="Decrease quantity" onClick={() => setQuantity(item.productId, item.quantity - 1)}><Minus className="h-3.5 w-3.5" /></button>
                        <span style={{ width: 32, textAlign: "center", fontSize: 13 }}>{item.quantity}</span>
                        <button aria-label="Increase quantity" onClick={() => setQuantity(item.productId, item.quantity + 1)}><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <button onClick={() => removeItem(item.productId)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>
                        <X className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="hz-summary-card" style={{ minHeight: "auto" }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>Summary</h2>
                <div className="hz-summary-line"><span>Subtotal</span><span style={{ fontWeight: 700, opacity: 1 }}>{cartItems[0]?.currency} {subtotal.toLocaleString()}</span></div>
                <div className="hz-summary-line"><span>Shipping</span><span>Calculated next step</span></div>
                <div className="hz-summary-total"><span>Total</span><span>{cartItems[0]?.currency} {subtotal.toLocaleString()}</span></div>
                <Link href={`/store/${slug}/checkout`} className="hz-btn hz-btn-yellow" style={{ width: "100%", justifyContent: "center", marginTop: 18 }}>
                  Proceed to Checkout <ArrowRight className="h-4 w-4" style={{ marginLeft: 6 }} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
