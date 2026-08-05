"use client";

import { use, useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { toast } from "sonner";

type Zone = { id: string; name: string; fee: unknown; estimatedMinutes: number | null };

export default function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
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
      <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-muted-foreground">
        Your cart is empty.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Checkout</h1>

      <div className="mb-6 rounded-lg border p-4 text-sm">
        {cartItems.map((i) => (
          <div key={i.productId} className="flex justify-between py-1">
            <span>{i.name} × {i.quantity}</span>
            <span>{i.currency} {(i.price * i.quantity).toLocaleString()}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-2 mt-2">
          <span>Subtotal</span>
          <span>{cartItems[0].currency} {subtotal.toLocaleString()}</span>
        </div>
        {selectedZone && (
          <div className="flex justify-between py-1 text-muted-foreground">
            <span>Delivery ({selectedZone.name})</span>
            <span>{cartItems[0].currency} {deliveryFee.toLocaleString()}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t pt-2 font-medium">
          <span>Total</span>
          <span>{cartItems[0].currency} {total.toLocaleString()}</span>
        </div>
      </div>

      {zones.length > 0 && (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Delivery area</label>
          <select className="input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
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
        <input required placeholder="Full name" className="input" value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <input required placeholder="Phone" className="input" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input required placeholder="Delivery address" className="input" value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="City" className="input" value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input required placeholder="State" className="input" value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </div>
        <input required placeholder="Country" className="input" value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md py-3 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--bn-marigold)", color: "var(--bn-ink)" }}
        >
          {isSubmitting ? "Redirecting to payment…" : `Pay ${cartItems[0].currency} ${total.toLocaleString()}`}
        </button>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
