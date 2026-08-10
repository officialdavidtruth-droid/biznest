"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { DeliveryZoneOptions } from "@/components/checkout/delivery-zone-options";
import { toast } from "sonner";
import { ShieldCheck, Lock, Truck, ChevronLeft } from "lucide-react";
import { ARCOVA } from "@/lib/template-themes";

type Zone = { id: string; name: string; city: string | null; fee: unknown; estimatedMinutes: number | null };

// Arcova design tokens — mirrors violet-checkout-client.tsx /
// marketplace-checkout-client.tsx's structure, recolored/reshaped to match
// the Arcova homepage/cart (dark editorial blocks, sharp square corners,
// gold accent, uppercase letter-spaced labels) so checkout doesn't feel
// like a different product.

export function ArcovaCheckoutClient({ slug }: { slug: string }) {
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
      <div style={{ border: `1px solid ${ARCOVA.border}` }} className="mx-auto mt-24 max-w-md px-8 py-14 text-center">
        <p style={{ opacity: 0.65, fontSize: 13 }}>Your cart is empty.</p>
        <Link href={`/store/${slug}`} style={{ color: ARCOVA.ink, borderBottom: `1px solid ${ARCOVA.ink}` }} className="mt-3 inline-block pb-0.5 text-xs font-semibold uppercase tracking-wide no-underline hover:opacity-70">
          Continue shopping &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", fontFamily: ARCOVA.font, color: ARCOVA.ink }} className="px-6 py-10">
      <div className="mb-8">
        <Link href={`/store/${slug}/cart`} style={{ color: ARCOVA.ink, opacity: 0.6 }} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide no-underline hover:opacity-100">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to cart
        </Link>
        <div style={{ borderBottom: `1px solid ${ARCOVA.border}` }} className="flex items-baseline justify-between pb-4">
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0.5 }}>CHECKOUT</h1>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ opacity: 0.5 }}>
            <span style={{ color: ARCOVA.accent, opacity: 1 }}>Cart</span>
            <span>&rarr;</span>
            <span style={{ color: ARCOVA.accent, opacity: 1 }}>Checkout</span>
            <span>&rarr;</span>
            <span>Payment</span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {zones.length > 0 && (
            <div style={{ border: `1px solid ${ARCOVA.border}` }} className="mb-5 p-6">
              <div className="mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4" style={{ color: ARCOVA.accent }} />
                <h2 style={{ fontSize: 14 }} className="font-bold uppercase tracking-wide">Delivery</h2>
              </div>
              <label style={{ opacity: 0.6 }} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide">Delivery area</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                style={{ background: "#f6f5f2", border: `1px solid ${ARCOVA.border}`, color: ARCOVA.ink }}
                className="w-full px-4 py-2.5 text-sm outline-none"
              >
                <option value="">Pickup / no delivery fee</option>
                <DeliveryZoneOptions zones={zones} />
              </select>
            </div>
          )}

          <div style={{ border: `1px solid ${ARCOVA.border}` }} className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: ARCOVA.accent }} />
              <h2 style={{ fontSize: 14 }} className="font-bold uppercase tracking-wide">Shipping details</h2>
            </div>

            <form id="arcova-checkout-form" onSubmit={handleSubmit} className="space-y-3">
              <Field label="Full name">
                <input required placeholder="Jordan Avery" className="arcova-input" value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <input required placeholder="080 000 0000" className="arcova-input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Delivery address">
                <input required placeholder="Street address" className="arcova-input" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input required placeholder="City" className="arcova-input" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input required placeholder="State" className="arcova-input" value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
              </div>
              <Field label="Country">
                <input required placeholder="Country" className="arcova-input" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Field>
            </form>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs" style={{ opacity: 0.55 }}>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Encrypted checkout</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Buyer protection</span>
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Delivery tracking included</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div
            style={{ background: ARCOVA.dark, color: "#fff" }}
            className="sticky top-24 flex flex-col gap-5 p-7"
          >
            <h2 style={{ fontSize: 17, letterSpacing: 0.5 }} className="font-bold uppercase">Order summary</h2>

            <div className="flex flex-col gap-3">
              {cartItems.map((i) => (
                <div key={i.productId} className="flex items-center gap-3">
                  <div style={{ background: "rgba(255,255,255,0.08)" }} className="h-12 w-12 flex-shrink-0 overflow-hidden">
                    {i.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
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

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }} className="flex flex-col gap-2.5 pt-5 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ opacity: 0.75 }}>Subtotal</span>
                <span className="font-semibold">{currency} {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ opacity: 0.75 }}>Delivery{selectedZone ? ` (${selectedZone.name})` : ""}</span>
                <span className="font-semibold">{selectedZone ? `${currency} ${deliveryFee.toLocaleString()}` : "Free / pickup"}</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }} className="flex items-end justify-between pt-5">
              <span className="text-sm font-semibold uppercase tracking-wide">Total</span>
              <span style={{ color: ARCOVA.accent }} className="text-2xl font-bold leading-none">{currency} {total.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              form="arcova-checkout-form"
              disabled={isSubmitting}
              style={{ background: ARCOVA.accent, color: "#141414" }}
              className="mt-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-widest transition hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Redirecting to payment…" : `Pay ${currency} ${total.toLocaleString()}`}
            </button>
            <p style={{ opacity: 0.45 }} className="text-center text-[11px] uppercase tracking-widest">Secure payment · Powered by BizNest</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .arcova-input {
          width: 100%;
          border: 1px solid ${ARCOVA.border};
          background: #f6f5f2;
          padding: 0.65rem 1rem;
          font-size: 0.875rem;
          outline: none;
          color: ${ARCOVA.ink};
          transition: border-color 0.15s ease;
        }
        .arcova-input:focus {
          border-color: ${ARCOVA.accent};
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ opacity: 0.6 }} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
