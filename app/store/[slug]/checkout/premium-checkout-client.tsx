"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { submitCheckout } from "@/lib/checkout/client";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { DeliveryZoneOptions } from "@/components/checkout/delivery-zone-options";
import { toast } from "sonner";
import { ShieldCheck, Lock, Truck, ChevronLeft } from "lucide-react";
import { PREMIUM } from "@/lib/template-themes";

type Zone = { id: string; name: string; city: string | null; fee: unknown; estimatedMinutes: number | null };

// Premium Marketplace design tokens — mirrors marketplace-checkout-client.tsx's
// structure, recolored/reshaped to match the Premium homepage/cart (rounded
// cards, muted panel background, dark summary panel) so checkout doesn't
// feel like a different product.

export function PremiumCheckoutClient({ slug }: { slug: string }) {
  const { items, storeSlug, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Generated once per page load and reused for every submit attempt
  // (including retries) — lets startCheckout recognize a duplicate
  // submission (double-click, retry after a slow response, back-button
  // resubmit) and hand back the same payment page instead of charging
  // the customer twice. See lib/actions/order.ts.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
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
    const result = await submitCheckout({
      slug,
      items: cartItems,
      deliveryZoneId: zoneId || undefined,
      shippingAddress: form,
      idempotencyKey,
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
      <div style={{ background: "#fff", border: "1px solid #e2e7e9", borderRadius: PREMIUM.radius }} className="mx-auto mt-20 max-w-md px-8 py-12 text-center">
        <p style={{ opacity: 0.7, fontSize: 13 }}>Your cart is empty.</p>
        <Link href={`/${slug}`} style={{ color: PREMIUM.accent, fontSize: 13 }} className="mt-3 inline-block font-semibold no-underline hover:opacity-80">
          Continue shopping →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ width: "90%", maxWidth: 1200, margin: "0 auto", fontFamily: PREMIUM.font, color: PREMIUM.ink, fontSize: 13 }} className="px-2 py-8">
      <div className="mb-6">
        <Link href={`/${slug}/cart`} style={{ color: PREMIUM.ink, opacity: 0.6 }} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold no-underline hover:opacity-100">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to cart
        </Link>
        <div style={{ borderBottom: "1px solid #e2e7e9" }} className="flex items-baseline justify-between pb-3">
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Checkout</h1>
          <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ opacity: 0.55 }}>
            <span style={{ color: PREMIUM.accent, opacity: 1 }}>Cart</span>
            <span>→</span>
            <span style={{ color: PREMIUM.accent, opacity: 1 }}>Checkout</span>
            <span>→</span>
            <span>Payment</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {zones.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e7e9", borderRadius: PREMIUM.radius }} className="mb-4 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4" style={{ color: PREMIUM.accent }} />
                <h2 style={{ fontSize: 13.5, fontWeight: 700 }}>Delivery</h2>
              </div>
              <label style={{ opacity: 0.6 }} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide">Delivery area</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                style={{ background: "#f7f9fa", border: "1px solid #e2e7e9", color: PREMIUM.ink, borderRadius: 6 }}
                className="w-full px-3 py-2.5 text-xs outline-none"
              >
                <option value="">Pickup / no delivery fee</option>
                <DeliveryZoneOptions zones={zones} />
              </select>
            </div>
          )}

          <div style={{ background: "#fff", border: "1px solid #e2e7e9", borderRadius: PREMIUM.radius }} className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: PREMIUM.accent }} />
              <h2 style={{ fontSize: 13.5, fontWeight: 700 }}>Shipping details</h2>
            </div>

            <form id="premium-checkout-form" onSubmit={handleSubmit} className="space-y-3">
              <Field label="Full name">
                <input required placeholder="Jordan Avery" className="premium-input" value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <input required placeholder="080 000 0000" className="premium-input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Delivery address">
                <input required placeholder="Street address" className="premium-input" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input required placeholder="City" className="premium-input" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input required placeholder="State" className="premium-input" value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
              </div>
              <Field label="Country">
                <input required placeholder="Country" className="premium-input" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Field>
            </form>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]" style={{ opacity: 0.6 }}>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Encrypted checkout</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Buyer protection</span>
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Delivery tracking included</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div
            style={{ background: "#1e2429", color: "#fff", borderRadius: PREMIUM.radius }}
            className="sticky top-24 flex flex-col gap-4 p-6"
          >
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Order summary</h2>

            <div className="flex flex-col gap-3">
              {cartItems.map((i) => (
                <div key={i.productId} className="flex items-center gap-3">
                  <div style={{ background: "#ffffff14" }} className="h-11 w-11 flex-shrink-0 overflow-hidden">
                    {i.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{i.name}</p>
                    <p style={{ opacity: 0.6 }} className="text-[11px]">Qty {i.quantity}</p>
                  </div>
                  <span className="text-xs font-semibold">{i.currency} {(i.price * i.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #ffffff22" }} className="flex flex-col gap-2 pt-4 text-xs">
              <div className="flex items-center justify-between">
                <span style={{ opacity: 0.8 }}>Subtotal</span>
                <span className="font-semibold">{currency} {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ opacity: 0.8 }}>Delivery{selectedZone ? ` (${selectedZone.name})` : ""}</span>
                <span className="font-semibold">{selectedZone ? `${currency} ${deliveryFee.toLocaleString()}` : "Free / pickup"}</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #ffffff22" }} className="flex items-end justify-between pt-4">
              <span style={{ fontSize: 13 }} className="font-semibold">Total</span>
              <span style={{ fontSize: 19 }} className="font-extrabold leading-none">{currency} {total.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              form="premium-checkout-form"
              disabled={isSubmitting}
              style={{ background: PREMIUM.accent, color: "#fff", borderRadius: 20 }}
              className="mt-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wide transition hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Redirecting to payment…" : `Pay ${currency} ${total.toLocaleString()}`}
            </button>
            <p style={{ opacity: 0.5 }} className="text-center text-[10px] uppercase tracking-widest">Secure payment · Powered by BizNest</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .premium-input {
          width: 100%;
          border: 1px solid #e2e7e9;
          border-radius: 6px;
          background: #f7f9fa;
          padding: 0.6rem 0.9rem;
          font-size: 0.8125rem;
          outline: none;
          color: ${PREMIUM.ink};
          transition: border-color 0.15s ease;
        }
        .premium-input:focus {
          border-color: ${PREMIUM.accent};
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ opacity: 0.6 }} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
