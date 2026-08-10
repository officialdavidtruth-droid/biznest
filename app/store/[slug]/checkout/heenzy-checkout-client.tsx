"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { toast } from "sonner";

type Zone = { id: string; name: string; fee: unknown; estimatedMinutes: number | null };

export function HeenzyCheckoutClient({ slug }: { slug: string }) {
  const { items, storeSlug, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<string>("");

  const [form, setForm] = useState({
    fullName: "", phone: "", address: "", city: "", state: "", country: "Nigeria",
  });

  useEffect(() => {
    listActiveDeliveryZones(slug).then(setZones);
  }, [slug]);

  const selectedZone = zones.find((z) => z.id === zoneId);
  const deliveryFee = selectedZone ? Number(selectedZone.fee) : 0;
  const total = subtotal + deliveryFee;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cartItems.length === 0) return;

    setIsSubmitting(true);
    const result = await startCheckout(slug, {
      items: cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      deliveryZoneId: zoneId || undefined,
      shippingAddress: form,
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    window.location.href = result.data.authorizationUrl;
  }

  if (cartItems.length === 0) {
    return (
      <div className="hz-root" style={{ minHeight: "100vh" }}>
        <div style={{ textAlign: "center", padding: "96px 24px", color: "#6b6b6b", fontSize: 14 }}>Your cart is empty.</div>
      </div>
    );
  }

  return (
    <div className="hz-root" style={{ minHeight: "100vh" }}>
      <div className="hz-wrap" style={{ maxWidth: 620, paddingTop: 48, paddingBottom: 64 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>Checkout</h1>

        <div className="hz-checkout-card" style={{ marginBottom: 20 }}>
          {cartItems.map((i) => (
            <div key={i.productId} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span>{i.name} × {i.quantity}</span>
              <span style={{ fontWeight: 700 }}>{i.currency} {(i.price * i.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #e7e7e7", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>Subtotal</span><span>{cartItems[0].currency} {subtotal.toLocaleString()}</span>
          </div>
          {selectedZone && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: .7, padding: "4px 0" }}>
              <span>Delivery ({selectedZone.name})</span><span>{cartItems[0].currency} {deliveryFee.toLocaleString()}</span>
            </div>
          )}
          <div style={{ borderTop: "1px solid #e7e7e7", marginTop: 6, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800 }}>
            <span>Total</span><span>{cartItems[0].currency} {total.toLocaleString()}</span>
          </div>
        </div>

        {zones.length > 0 && (
          <div className="hz-field">
            <label>Delivery area</label>
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">Pickup / no delivery fee</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} — {Number(z.fee).toLocaleString()}{z.estimatedMinutes ? ` (~${z.estimatedMinutes} min)` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="hz-field"><label>Full name</label><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div className="hz-field"><label>Phone</label><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="hz-field"><label>Delivery address</label><input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="hz-field-row">
            <div className="hz-field"><label>City</label><input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="hz-field"><label>State</label><input required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
          </div>
          <div className="hz-field"><label>Country</label><input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>

          <button type="submit" disabled={isSubmitting} className="hz-btn hz-btn-yellow" style={{ width: "100%", marginTop: 8, opacity: isSubmitting ? .6 : 1 }}>
            {isSubmitting ? "Redirecting to payment…" : `Pay ${cartItems[0].currency} ${total.toLocaleString()}`}
          </button>
        </form>
      </div>
    </div>
  );
}
