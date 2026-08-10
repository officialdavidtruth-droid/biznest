"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { toast } from "sonner";
import { ShieldCheck, Lock, Truck, ChevronLeft } from "lucide-react";
import { RRW } from "@/lib/template-themes";

type Zone = { id: string; name: string; fee: unknown; estimatedMinutes: number | null };

// rRW design tokens — mirrors homevista-checkout-client.tsx's structure,
// recolored/reshaped to match the rRW homepage/cart (sharp 3px corners,
// dark #080a0d summary panel, pill buttons, blue accent) so checkout
// doesn't feel like a different product.

export function RrwCheckoutClient({ slug }: { slug: string }) {
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
  const currency = cartItems[0]?.currency ?? "NGN";

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
      <div style={{ border: "1px solid #ddd" }} className="mx-auto mt-24 max-w-md px-8 py-14 text-center">
        <p style={{ opacity: 0.6, fontSize: 11 }}>Your cart is empty.</p>
        <Link href={`/store/${slug}`} style={{ color: RRW.ink, fontWeight: 700, borderBottom: `1px solid ${RRW.ink}` }} className="mt-3 inline-block pb-0.5 text-xs no-underline hover:opacity-70">
          Continue browsing &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 6% 60px", fontFamily: RRW.font, color: RRW.ink }}>
      <div className="mb-8">
        <Link href={`/store/${slug}/cart`} style={{ color: RRW.ink, opacity: 0.55 }} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold no-underline hover:opacity-100">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to cart
        </Link>
        <div style={{ borderBottom: "1px solid #ddd" }} className="flex items-baseline justify-between pb-4">
          <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: 0 }}>Checkout</h1>
          <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ opacity: 0.5 }}>
            <span style={{ color: RRW.accent, opacity: 1 }}>Cart</span>
            <span>&rarr;</span>
            <span style={{ color: RRW.accent, opacity: 1 }}>Checkout</span>
            <span>&rarr;</span>
            <span>Payment</span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {zones.length > 0 && (
            <div style={{ border: "1px solid #ddd" }} className="mb-5 p-6">
              <div className="mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4" style={{ color: RRW.accent }} />
                <h2 style={{ fontSize: 13, fontWeight: 700 }}>Delivery</h2>
              </div>
              <label style={{ opacity: 0.6 }} className="mb-1.5 block text-xs font-semibold">Delivery area</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                style={{ background: "#f4f5f6", border: "1px solid #ddd", color: RRW.ink, borderRadius: 3 }}
                className="w-full px-4 py-2.5 text-sm outline-none"
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

          <div style={{ border: "1px solid #ddd" }} className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: RRW.accent }} />
              <h2 style={{ fontSize: 13, fontWeight: 700 }}>Shipping details</h2>
            </div>

            <form id="rrw-checkout-form" onSubmit={handleSubmit} className="space-y-3">
              <Field label="Full name">
                <input required placeholder="Jordan Avery" className="rrw-input" value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <input required placeholder="080 000 0000" className="rrw-input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Delivery address">
                <input required placeholder="Street address" className="rrw-input" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input required placeholder="City" className="rrw-input" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input required placeholder="State" className="rrw-input" value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
              </div>
              <Field label="Country">
                <input required placeholder="Country" className="rrw-input" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Field>
            </form>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs" style={{ opacity: 0.5 }}>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Encrypted checkout</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Buyer protection</span>
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Delivery tracking included</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div
            style={{ background: "#080a0d", color: "#fff" }}
            className="sticky top-24 flex flex-col gap-5 p-7"
          >
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Order summary</h2>

            <div className="flex flex-col gap-3">
              {cartItems.map((i) => (
                <div key={i.productId} className="flex items-center gap-3">
                  <div style={{ background: "rgba(255,255,255,0.08)" }} className="h-12 w-12 flex-shrink-0 overflow-hidden">
                    {i.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image} alt={i.name} className="h-full w-full object-contain" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.name}</p>
                    <p style={{ opacity: 0.6 }} className="text-xs">Qty {i.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold">{i.currency} {(i.price * i.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #292b2e" }} className="flex flex-col gap-2.5 pt-5 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ opacity: 0.65, fontSize: 11 }}>Subtotal</span>
                <span className="font-semibold">{currency} {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ opacity: 0.65, fontSize: 11 }}>Delivery{selectedZone ? ` (${selectedZone.name})` : ""}</span>
                <span className="font-semibold">{selectedZone ? `${currency} ${deliveryFee.toLocaleString()}` : "Free / pickup"}</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #292b2e" }} className="flex items-end justify-between pt-5">
              <span className="text-sm font-semibold">Total</span>
              <span style={{ color: RRW.accent }} className="text-2xl font-bold leading-none">{currency} {total.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              form="rrw-checkout-form"
              disabled={isSubmitting}
              style={{ background: RRW.accent, color: "#fff", borderRadius: 20 }}
              className="mt-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Redirecting to payment…" : `Pay ${currency} ${total.toLocaleString()}`}
            </button>
            <p style={{ opacity: 0.4, fontSize: 9 }} className="text-center">Secure payment · Powered by BizNest</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .rrw-input {
          width: 100%;
          border: 1px solid #ddd;
          border-radius: 3px;
          background: #f4f5f6;
          padding: 0.65rem 1rem;
          font-size: 0.875rem;
          outline: none;
          color: ${RRW.ink};
          transition: border-color 0.15s ease;
        }
        .rrw-input:focus {
          border-color: ${RRW.accent};
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ opacity: 0.6 }} className="mb-1.5 block text-xs font-semibold">{label}</label>
      {children}
    </div>
  );
}
