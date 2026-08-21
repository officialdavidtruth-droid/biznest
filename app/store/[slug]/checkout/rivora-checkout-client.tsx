"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { DeliveryZoneOptions } from "@/components/checkout/delivery-zone-options";
import { toast } from "sonner";
import { ShieldCheck, Lock, Truck, ChevronLeft } from "lucide-react";
import { RIVORA } from "@/lib/template-themes";

type Zone = { id: string; name: string; city: string | null; fee: unknown; estimatedMinutes: number | null };

// Rivora Fresh design tokens — mirrors nova-checkout-client.tsx /
// premium-checkout-client.tsx's structure, recolored to the deep-green /
// lime grocery look with rounded 11px cards used across the rest of a
// Rivora-templated store.

export function RivoraCheckoutClient({ slug }: { slug: string }) {
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
      <div style={{ background: "#fff", borderRadius: 11, color: RIVORA.ink }} className="mx-auto mt-24 max-w-md px-8 py-14 text-center">
        <p style={{ color: RIVORA.muted, fontSize: 13 }}>Your cart is empty.</p>
        <Link href={`/${slug}`} style={{ color: RIVORA.green }} className="mt-3 inline-block text-xs font-bold no-underline hover:opacity-70">
          Continue shopping →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", fontFamily: RIVORA.font, color: RIVORA.ink, background: "#f7f9f6" }} className="px-[5%] py-10">
      <div className="mb-7">
        <Link href={`/${slug}/cart`} style={{ color: RIVORA.muted }} className="mb-3 inline-flex items-center gap-1 text-xs font-bold no-underline hover:opacity-100">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to cart
        </Link>
        <div style={{ borderBottom: "1px solid #dfe8e2" }} className="flex items-baseline justify-between pb-4">
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Checkout</h1>
          <div className="flex items-center gap-2 text-[10px] font-bold" style={{ color: RIVORA.muted }}>
            <span style={{ color: RIVORA.green }}>Cart</span>
            <span>→</span>
            <span style={{ color: RIVORA.green }}>Checkout</span>
            <span>→</span>
            <span>Payment</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {zones.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 11 }} className="mb-4 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4" style={{ color: RIVORA.green }} />
                <h2 style={{ fontSize: 12, fontWeight: 800 }}>Delivery</h2>
              </div>
              <label style={{ color: RIVORA.muted }} className="mb-1.5 block text-[11px] font-bold">Delivery area</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                style={{ background: "#f0f4f1", border: "1px solid #dfe8e2", color: RIVORA.ink, borderRadius: 7 }}
                className="w-full px-3 py-2.5 text-sm outline-none"
              >
                <option value="">Pickup / no delivery fee</option>
                <DeliveryZoneOptions zones={zones} />
              </select>
            </div>
          )}

          <div style={{ background: "#fff", borderRadius: 11 }} className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: RIVORA.green }} />
              <h2 style={{ fontSize: 12, fontWeight: 800 }}>Delivery details</h2>
            </div>

            <form id="rivora-checkout-form" onSubmit={handleSubmit} className="space-y-3">
              <Field label="Full name">
                <input required placeholder="Jordan Avery" className="rivora-input" value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <input required placeholder="080 000 0000" className="rivora-input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Delivery address">
                <input required placeholder="Street address" className="rivora-input" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input required placeholder="City" className="rivora-input" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input required placeholder="State" className="rivora-input" value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
              </div>
              <Field label="Country">
                <input required placeholder="Country" className="rivora-input" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Field>
            </form>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]" style={{ color: RIVORA.muted }}>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Encrypted checkout</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Buyer protection</span>
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Delivery tracking included</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div
            style={{ background: RIVORA.deep, color: "#fff", borderRadius: 11 }}
            className="sticky top-24 flex flex-col gap-4 p-6"
          >
            <h2 style={{ fontSize: 15, fontWeight: 800 }}>Order summary</h2>

            <div className="flex flex-col gap-3">
              {cartItems.map((i) => (
                <div key={i.productId} className="flex items-center gap-3">
                  <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 7 }} className="h-11 w-11 flex-shrink-0 overflow-hidden">
                    {i.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{i.name}</p>
                    <p style={{ color: "#b7c8bf" }} className="text-[11px]">Qty {i.quantity}</p>
                  </div>
                  <span className="text-xs font-bold">{i.currency} {(i.price * i.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #164634" }} className="flex flex-col gap-2 pt-4 text-xs">
              <div className="flex items-center justify-between">
                <span style={{ color: "#b7c8bf" }}>Subtotal</span>
                <span className="font-semibold">{currency} {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "#b7c8bf" }}>Delivery{selectedZone ? ` (${selectedZone.name})` : ""}</span>
                <span className="font-semibold">{selectedZone ? `${currency} ${deliveryFee.toLocaleString()}` : "Free / pickup"}</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #164634" }} className="flex items-end justify-between pt-4">
              <span style={{ fontSize: 11, fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: RIVORA.lime }} className="leading-none">{currency} {total.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              form="rivora-checkout-form"
              disabled={isSubmitting}
              style={{ background: RIVORA.lime, color: "#153600", borderRadius: 7 }}
              className="mt-1 flex items-center justify-center gap-2 py-3.5 text-xs font-extrabold transition hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Redirecting to payment…" : `Pay ${currency} ${total.toLocaleString()}`}
            </button>
            <p style={{ color: "#8ea298" }} className="text-center text-[10px]">Secure payment · Powered by BizNest</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .rivora-input {
          width: 100%;
          border: 1px solid #dfe8e2;
          border-radius: 7px;
          background: #f0f4f1;
          padding: 0.6rem 0.9rem;
          font-size: 0.8rem;
          outline: none;
          color: ${RIVORA.ink};
          transition: border-color 0.15s ease;
        }
        .rivora-input:focus {
          border-color: ${RIVORA.green};
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ color: RIVORA.muted }} className="mb-1.5 block text-[11px] font-bold">{label}</label>
      {children}
    </div>
  );
}
