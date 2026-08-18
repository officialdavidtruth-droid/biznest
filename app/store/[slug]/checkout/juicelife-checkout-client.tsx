"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { DeliveryZoneOptions } from "@/components/checkout/delivery-zone-options";
import { toast } from "sonner";
import { ShieldCheck, Lock, Truck, ChevronLeft } from "lucide-react";
import { JUICELIFE } from "@/lib/template-themes";

type Zone = { id: string; name: string; city: string | null; fee: unknown; estimatedMinutes: number | null };

// JuiceLife design tokens — mirrors rivora-checkout-client.tsx's
// structure, recolored to the green/orange, rounded-pill look used
// across the rest of a JuiceLife-templated store.

export function JuiceLifeCheckoutClient({ slug }: { slug: string }) {
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
      <div style={{ background: "#fff", borderRadius: JUICELIFE.radius, border: "1px solid #edf1eb", color: JUICELIFE.ink }} className="mx-auto mt-24 max-w-md px-8 py-14 text-center">
        <p style={{ color: JUICELIFE.muted, fontSize: 13 }}>Your cart is empty.</p>
        <Link href={`/${slug}`} style={{ color: JUICELIFE.green }} className="mt-3 inline-block text-xs font-bold no-underline hover:opacity-70">
          Continue shopping →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", fontFamily: JUICELIFE.font, color: JUICELIFE.ink, background: JUICELIFE.soft }} className="px-[6%] py-10">
      <div className="mb-7">
        <Link href={`/${slug}/cart`} style={{ color: JUICELIFE.muted }} className="mb-3 inline-flex items-center gap-1 text-xs font-bold no-underline hover:opacity-100">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to cart
        </Link>
        <div style={{ borderBottom: "1px solid #e5e9e2" }} className="flex items-baseline justify-between pb-4">
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Checkout</h1>
          <div className="flex items-center gap-2 text-[10px] font-bold" style={{ color: JUICELIFE.muted }}>
            <span style={{ color: JUICELIFE.green }}>Cart</span>
            <span>→</span>
            <span style={{ color: JUICELIFE.green }}>Checkout</span>
            <span>→</span>
            <span>Payment</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {zones.length > 0 && (
            <div style={{ background: "#fff", borderRadius: JUICELIFE.radius, border: "1px solid #edf1eb" }} className="mb-4 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4" style={{ color: JUICELIFE.green }} />
                <h2 style={{ fontSize: 12, fontWeight: 800 }}>Delivery</h2>
              </div>
              <label style={{ color: JUICELIFE.muted }} className="mb-1.5 block text-[11px] font-bold">Delivery area</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                style={{ background: "#f7faf3", border: "1px solid #dbe5d7", color: JUICELIFE.ink, borderRadius: 9 }}
                className="w-full px-3 py-2.5 text-sm outline-none"
              >
                <option value="">Pickup / no delivery fee</option>
                <DeliveryZoneOptions zones={zones} />
              </select>
            </div>
          )}

          <div style={{ background: "#fff", borderRadius: JUICELIFE.radius, border: "1px solid #edf1eb" }} className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: JUICELIFE.green }} />
              <h2 style={{ fontSize: 12, fontWeight: 800 }}>Delivery details</h2>
            </div>

            <form id="juicelife-checkout-form" onSubmit={handleSubmit} className="space-y-3">
              <Field label="Full name">
                <input required placeholder="Jordan Avery" className="juicelife-input" value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <input required placeholder="080 000 0000" className="juicelife-input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Delivery address">
                <input required placeholder="Street address" className="juicelife-input" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input required placeholder="City" className="juicelife-input" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input required placeholder="State" className="juicelife-input" value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
              </div>
              <Field label="Country">
                <input required placeholder="Country" className="juicelife-input" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Field>
            </form>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]" style={{ color: JUICELIFE.muted }}>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Encrypted checkout</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Buyer protection</span>
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Delivery tracking included</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div
            style={{ background: JUICELIFE.greenDark, color: "#fff", borderRadius: JUICELIFE.radius }}
            className="sticky top-24 flex flex-col gap-4 p-6"
          >
            <h2 style={{ fontSize: 15, fontWeight: 800 }}>Order summary</h2>

            <div className="flex flex-col gap-3">
              {cartItems.map((i) => (
                <div key={i.productId} className="flex items-center gap-3">
                  <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 9 }} className="h-11 w-11 flex-shrink-0 overflow-hidden">
                    {i.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{i.name}</p>
                    <p style={{ color: "#c7ddc9" }} className="text-[11px]">Qty {i.quantity}</p>
                  </div>
                  <span className="text-xs font-bold">{i.currency} {(i.price * i.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #146a1e" }} className="flex flex-col gap-2 pt-4 text-xs">
              <div className="flex items-center justify-between">
                <span style={{ color: "#c7ddc9" }}>Subtotal</span>
                <span className="font-semibold">{currency} {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "#c7ddc9" }}>Delivery{selectedZone ? ` (${selectedZone.name})` : ""}</span>
                <span className="font-semibold">{selectedZone ? `${currency} ${deliveryFee.toLocaleString()}` : "Free / pickup"}</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #146a1e" }} className="flex items-end justify-between pt-4">
              <span style={{ fontSize: 11, fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: JUICELIFE.orange }} className="leading-none">{currency} {total.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              form="juicelife-checkout-form"
              disabled={isSubmitting}
              style={{ background: JUICELIFE.orange, color: "#fff", borderRadius: 22 }}
              className="mt-1 flex items-center justify-center gap-2 py-3.5 text-xs font-extrabold transition hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Redirecting to payment…" : `Pay ${currency} ${total.toLocaleString()}`}
            </button>
            <p style={{ color: "#a9c2ac" }} className="text-center text-[10px]">Secure payment · Powered by BizNest</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .juicelife-input {
          width: 100%;
          border: 1px solid #dbe5d7;
          border-radius: 9px;
          background: #f7faf3;
          padding: 0.6rem 0.9rem;
          font-size: 0.8rem;
          outline: none;
          color: ${JUICELIFE.ink};
          transition: border-color 0.15s ease;
        }
        .juicelife-input:focus {
          border-color: ${JUICELIFE.green};
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ color: JUICELIFE.muted }} className="mb-1.5 block text-[11px] font-bold">{label}</label>
      {children}
    </div>
  );
}
