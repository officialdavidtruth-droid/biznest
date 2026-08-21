"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { DeliveryZoneOptions } from "@/components/checkout/delivery-zone-options";
import { toast } from "sonner";
import { ShieldCheck, Lock, Truck, ChevronLeft } from "lucide-react";
import { VIOLET } from "@/lib/template-themes";

type Zone = { id: string; name: string; city: string | null; fee: unknown; estimatedMinutes: number | null };

// Violet design tokens — mirrors checkout-client.tsx's structure, recolored
// to match the Violet homepage/cart (purple accent, pill buttons, rounded
// cards) so checkout doesn't feel like a different product.

export function VioletCheckoutClient({ slug }: { slug: string }) {
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
    const result = await startCheckout(slug, {
      items: cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
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
      <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 5px 20px #20144b0a" }} className="mx-auto mt-24 max-w-md px-8 py-14 text-center">
        <p style={{ opacity: 0.75 }} className="text-sm">Your cart is empty.</p>
        <Link href={`/${slug}`} style={{ color: VIOLET.accent }} className="mt-3 inline-block text-sm font-semibold no-underline hover:opacity-80">
          Continue shopping →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-6 py-10">
      <div className="mb-8">
        <Link href={`/${slug}/cart`} style={{ color: VIOLET.ink, opacity: 0.6 }} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold no-underline hover:opacity-100">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to cart
        </Link>
        <div style={{ borderBottom: `1px solid ${VIOLET.ink}1a` }} className="flex items-baseline justify-between pb-4">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Checkout</h1>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ opacity: 0.55 }}>
            <span style={{ color: VIOLET.accent, opacity: 1 }}>Cart</span>
            <span>→</span>
            <span style={{ color: VIOLET.accent, opacity: 1 }}>Checkout</span>
            <span>→</span>
            <span>Payment</span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {zones.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 5px 20px #20144b0a" }} className="mb-5 p-6">
              <div className="mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4" style={{ color: VIOLET.accent }} />
                <h2 className="text-base font-bold">Delivery</h2>
              </div>
              <label style={{ opacity: 0.6 }} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide">Delivery area</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                style={{ background: "#f6f7fb", border: `1px solid ${VIOLET.ink}22`, color: VIOLET.ink }}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              >
                <option value="">Pickup / no delivery fee</option>
                <DeliveryZoneOptions zones={zones} />
              </select>
            </div>
          )}

          <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 5px 20px #20144b0a" }} className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: VIOLET.accent }} />
              <h2 className="text-base font-bold">Shipping details</h2>
            </div>

            <form id="violet-checkout-form" onSubmit={handleSubmit} className="space-y-3">
              <Field label="Full name">
                <input required placeholder="Jordan Avery" className="violet-input" value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <input required placeholder="080 000 0000" className="violet-input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Delivery address">
                <input required placeholder="Street address" className="violet-input" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input required placeholder="City" className="violet-input" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input required placeholder="State" className="violet-input" value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
              </div>
              <Field label="Country">
                <input required placeholder="Country" className="violet-input" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Field>
            </form>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs" style={{ opacity: 0.6 }}>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Encrypted checkout</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Buyer protection</span>
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Delivery tracking included</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div
            style={{ background: VIOLET.navy, color: "#fff", borderRadius: 20, boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}
            className="sticky top-24 flex flex-col gap-5 p-7"
          >
            <h2 className="text-xl font-bold">Order summary</h2>

            <div className="flex flex-col gap-3">
              {cartItems.map((i) => (
                <div key={i.productId} className="flex items-center gap-3">
                  <div style={{ background: "#ffffff14", borderRadius: 12 }} className="h-12 w-12 flex-shrink-0 overflow-hidden">
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

            <div style={{ borderTop: "1px solid #ffffff22" }} className="flex flex-col gap-2.5 pt-5 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ opacity: 0.8 }}>Subtotal</span>
                <span className="font-semibold">{currency} {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ opacity: 0.8 }}>Delivery{selectedZone ? ` (${selectedZone.name})` : ""}</span>
                <span className="font-semibold">{selectedZone ? `${currency} ${deliveryFee.toLocaleString()}` : "Free / pickup"}</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #ffffff22" }} className="flex items-end justify-between pt-5">
              <span className="text-base font-semibold">Total</span>
              <span className="text-2xl font-extrabold leading-none">{currency} {total.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              form="violet-checkout-form"
              disabled={isSubmitting}
              style={{ background: VIOLET.accent, color: "#fff" }}
              className="mt-1 flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isSubmitting ? "Redirecting to payment…" : `Pay ${currency} ${total.toLocaleString()}`}
            </button>
            <p style={{ opacity: 0.5 }} className="text-center text-[11px] uppercase tracking-widest">Secure payment · Powered by BizNest</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .violet-input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid ${VIOLET.ink}22;
          background: #f6f7fb;
          padding: 0.65rem 1rem;
          font-size: 0.875rem;
          outline: none;
          color: ${VIOLET.ink};
          transition: border-color 0.15s ease;
        }
        .violet-input:focus {
          border-color: ${VIOLET.accent};
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
