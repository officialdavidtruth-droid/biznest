"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { DeliveryZoneOptions } from "@/components/checkout/delivery-zone-options";
import { toast } from "sonner";
import { ShieldCheck, Lock, Truck, ChevronLeft } from "lucide-react";
import { NOVA } from "@/lib/template-themes";

type Zone = { id: string; name: string; city: string | null; fee: unknown; estimatedMinutes: number | null };

// Nova design tokens — mirrors arcova-checkout-client.tsx's structure,
// recolored to the Nova homepage/cart's dark editorial black/cream/gold
// look with serif display type, so checkout doesn't feel like a different
// product.

const serif = { fontFamily: NOVA.headlineFont } as const;
const label = { fontFamily: "monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: NOVA.gold };

export function NovaCheckoutClient({ slug }: { slug: string }) {
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
      <div style={{ border: `1px solid ${NOVA.line}`, background: NOVA.black, color: NOVA.cream }} className="mx-auto mt-24 max-w-md px-8 py-14 text-center">
        <p style={{ color: NOVA.gray, fontSize: 13 }}>Your cart is empty.</p>
        <Link href={`/${slug}`} style={{ ...label, color: NOVA.cream, borderBottom: `1px solid ${NOVA.line}` }} className="mt-4 inline-block pb-1 no-underline hover:opacity-70">
          Continue shopping →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", fontFamily: NOVA.font, color: NOVA.cream, background: NOVA.black }} className="px-6 py-10">
      <div className="mb-8">
        <Link href={`/store/${slug}/cart`} style={{ ...label, color: NOVA.cream }} className="mb-4 inline-flex items-center gap-1 no-underline hover:opacity-75">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to cart
        </Link>
        <div style={{ borderBottom: `1px solid ${NOVA.line}` }} className="flex items-baseline justify-between pb-5">
          <h1 style={{ ...serif, fontSize: 30, fontWeight: 700 }}>Checkout</h1>
          <div style={{ ...label, color: NOVA.gray }} className="flex items-center gap-2">
            <span style={{ color: NOVA.gold }}>Cart</span>
            <span>→</span>
            <span style={{ color: NOVA.gold }}>Checkout</span>
            <span>→</span>
            <span>Payment</span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {zones.length > 0 && (
            <div style={{ border: `1px solid ${NOVA.line}` }} className="mb-5 p-6">
              <div className="mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4" style={{ color: NOVA.gold }} />
                <h2 style={label} className="!text-[13px]">Delivery</h2>
              </div>
              <label style={{ color: NOVA.gray, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }} className="mb-1.5 block font-semibold">Delivery area</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                style={{ background: NOVA.charcoal, border: `1px solid ${NOVA.line}`, color: NOVA.cream }}
                className="w-full px-4 py-2.5 text-sm outline-none"
              >
                <option value="">Pickup / no delivery fee</option>
                <DeliveryZoneOptions zones={zones} />
              </select>
            </div>
          )}

          <div style={{ border: `1px solid ${NOVA.line}` }} className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: NOVA.gold }} />
              <h2 style={label} className="!text-[13px]">Shipping details</h2>
            </div>

            <form id="nova-checkout-form" onSubmit={handleSubmit} className="space-y-3">
              <Field label="Full name">
                <input required placeholder="Jordan Avery" className="nova-input" value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <input required placeholder="080 000 0000" className="nova-input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Delivery address">
                <input required placeholder="Street address" className="nova-input" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input required placeholder="City" className="nova-input" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input required placeholder="State" className="nova-input" value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
              </div>
              <Field label="Country">
                <input required placeholder="Country" className="nova-input" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Field>
            </form>
          </div>

          <div style={{ color: NOVA.gray }} className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Encrypted checkout</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Buyer protection</span>
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Delivery tracking included</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div
            style={{ background: NOVA.charcoal, border: `1px solid ${NOVA.line}` }}
            className="sticky top-24 flex flex-col gap-5 p-7"
          >
            <h2 style={{ ...serif, fontSize: 18, fontWeight: 700 }}>Order summary</h2>

            <div className="flex flex-col gap-3">
              {cartItems.map((i) => (
                <div key={i.productId} className="flex items-center gap-3">
                  <div style={{ background: "rgba(245,242,234,0.08)", border: `1px solid ${NOVA.line}` }} className="h-12 w-12 flex-shrink-0 overflow-hidden">
                    {i.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.name}</p>
                    <p style={{ color: NOVA.gray }} className="text-xs">Qty {i.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold">{i.currency} {(i.price * i.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${NOVA.line}` }} className="flex flex-col gap-2.5 pt-5 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ color: NOVA.gray }}>Subtotal</span>
                <span className="font-semibold">{currency} {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: NOVA.gray }}>Delivery{selectedZone ? ` (${selectedZone.name})` : ""}</span>
                <span className="font-semibold">{selectedZone ? `${currency} ${deliveryFee.toLocaleString()}` : "Free / pickup"}</span>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${NOVA.line}` }} className="flex items-end justify-between pt-5">
              <span style={label}>Total</span>
              <span style={{ ...serif, color: NOVA.gold }} className="text-2xl font-bold leading-none">{currency} {total.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              form="nova-checkout-form"
              disabled={isSubmitting}
              style={{ background: NOVA.gold, color: NOVA.black }}
              className="mt-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-widest transition hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Redirecting to payment…" : `Pay ${currency} ${total.toLocaleString()}`}
            </button>
            <p style={{ color: NOVA.gray }} className="text-center text-[11px] uppercase tracking-widest">Secure payment · Powered by BizNest</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .nova-input {
          width: 100%;
          border: 1px solid ${NOVA.line};
          background: ${NOVA.charcoal};
          padding: 0.65rem 1rem;
          font-size: 0.875rem;
          outline: none;
          color: ${NOVA.cream};
          transition: border-color 0.15s ease;
        }
        .nova-input:focus {
          border-color: ${NOVA.gold};
        }
        .nova-input::placeholder {
          color: ${NOVA.gray};
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ color: NOVA.gray, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }} className="mb-1.5 block font-semibold">{label}</label>
      {children}
    </div>
  );
}
