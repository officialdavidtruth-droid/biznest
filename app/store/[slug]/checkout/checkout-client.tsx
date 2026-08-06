"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { toast } from "sonner";

type Zone = { id: string; name: string; fee: unknown; estimatedMinutes: number | null };

// Lumina design tokens — see lib/template-themes.ts LUMINA / cart/page.tsx.
const ACCENT = "#0041C8";
const INK = "#141D23";
const SURFACE = "#F6FAFF";
const CARD = "#FFFFFF";
const CARD_ALT = "#E6EFF8";

export function CheckoutClient({ slug }: { slug: string }) {
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
      <div style={{ background: SURFACE, minHeight: "100vh" }}>
        <div style={{ color: INK, opacity: 0.7 }} className="mx-auto max-w-md px-6 py-24 text-center text-sm">
          Your cart is empty.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: SURFACE, color: INK, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <div className="mx-auto max-w-xl px-6 py-14">
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="mb-8 text-3xl font-extrabold">Checkout</h1>

        <div style={{ background: CARD_ALT, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="mb-6 p-5 text-sm">
          {cartItems.map((i) => (
            <div key={i.productId} className="flex justify-between py-1.5">
              <span>{i.name} × {i.quantity}</span>
              <span className="font-medium">{i.currency} {(i.price * i.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${INK}1a` }} className="mt-2 flex justify-between pt-2.5">
            <span>Subtotal</span>
            <span>{cartItems[0].currency} {subtotal.toLocaleString()}</span>
          </div>
          {selectedZone && (
            <div style={{ opacity: 0.7 }} className="flex justify-between py-1">
              <span>Delivery ({selectedZone.name})</span>
              <span>{cartItems[0].currency} {deliveryFee.toLocaleString()}</span>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${INK}1a` }} className="mt-1.5 flex justify-between pt-2.5 text-base font-bold">
            <span>Total</span>
            <span>{cartItems[0].currency} {total.toLocaleString()}</span>
          </div>
        </div>

        {zones.length > 0 && (
          <div className="mb-4">
            <label style={{ opacity: 0.6 }} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide">Delivery area</label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              style={{ background: CARD, border: `1px solid ${INK}22`, color: INK }}
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#0041C8]"
            >
              <option value="">Pickup / no delivery fee</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} — {Number(z.fee).toLocaleString()}{z.estimatedMinutes ? ` (~${z.estimatedMinutes} min)` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Full name" style={inputStyle} className="lumina-input" value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input required placeholder="Phone" style={inputStyle} className="lumina-input" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input required placeholder="Delivery address" style={inputStyle} className="lumina-input" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="City" style={inputStyle} className="lumina-input" value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input required placeholder="State" style={inputStyle} className="lumina-input" value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
          <input required placeholder="Country" style={inputStyle} className="lumina-input" value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })} />

          <button
            type="submit"
            disabled={isSubmitting}
            style={{ background: ACCENT, color: "#fff", boxShadow: `0 8px 20px ${ACCENT}4d` }}
            className="mt-2 w-full rounded-xl py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isSubmitting ? "Redirecting to payment…" : `Pay ${cartItems[0].currency} ${total.toLocaleString()}`}
          </button>
        </form>
      </div>

      <style jsx global>{`
        .lumina-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid ${INK}22;
          background: ${CARD};
          padding: 0.65rem 1rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .lumina-input:focus {
          border-color: ${ACCENT};
        }
      `}</style>
    </div>
  );
}

const inputStyle = { color: INK };
