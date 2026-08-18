"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { DeliveryZoneOptions } from "@/components/checkout/delivery-zone-options";
import { toast } from "sonner";
import { ShieldCheck, Lock, Truck, ChevronLeft } from "lucide-react";

type Zone = { id: string; name: string; city: string | null; fee: unknown; estimatedMinutes: number | null };

// Lumina design tokens — matches cart/cart-client.tsx exactly, so the
// checkout doesn't feel like a different, lower-effort product from the
// cart the customer just came from.
const ACCENT = "#0041C8";
const INK = "#141D23";
const SURFACE = "#F6FAFF";
const CARD = "#FFFFFF";
const CARD_ALT = "#E6EFF8";
const INVERSE = "#293138";
const INVERSE_INK = "#E9F2FB";

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
      <div style={{ background: SURFACE, minHeight: "100vh" }} className="storefront-root">
        <div style={{ background: CARD, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="mx-auto mt-24 max-w-md px-8 py-14 text-center">
          <p style={{ color: INK, opacity: 0.75 }} className="text-sm">Your cart is empty.</p>
          <Link href={`/${slug}`} style={{ color: ACCENT }} className="mt-3 inline-block text-sm font-semibold no-underline hover:opacity-80">
            Continue shopping →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: SURFACE, color: INK, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }} className="storefront-root">
      <div style={{ maxWidth: 1280 }} className="mx-auto px-6 py-14">
        {/* ---------- HEADER + STEP INDICATOR ---------- */}
        <div className="mb-8">
          <Link href={`/${slug}/cart`} style={{ color: INK, opacity: 0.6 }} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold no-underline hover:opacity-100">
            <ChevronLeft className="h-3.5 w-3.5" /> Back to cart
          </Link>
          <div style={{ borderBottom: `1px solid ${INK}1a` }} className="flex items-baseline justify-between pb-4">
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-3xl font-extrabold sm:text-4xl">Checkout</h1>
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ opacity: 0.55 }}>
              <span style={{ color: ACCENT, opacity: 1 }}>Cart</span>
              <span>→</span>
              <span style={{ color: ACCENT, opacity: 1 }}>Checkout</span>
              <span>→</span>
              <span>Payment</span>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* ---------- LEFT: FORM ---------- */}
          <div className="lg:col-span-7">
            {zones.length > 0 && (
              <div style={{ background: CARD, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="mb-5 p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4" style={{ color: ACCENT }} />
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-base font-bold">Delivery</h2>
                </div>
                <label style={{ opacity: 0.6 }} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide">Delivery area</label>
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  style={{ background: SURFACE, border: `1px solid ${INK}22`, color: INK }}
                  className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#0041C8]"
                >
                  <option value="">Pickup / no delivery fee</option>
                  <DeliveryZoneOptions zones={zones} />
                </select>
              </div>
            )}

            <div style={{ background: CARD, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" style={{ color: ACCENT }} />
                <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-base font-bold">Shipping details</h2>
              </div>

              <form id="checkout-form" onSubmit={handleSubmit} className="space-y-3">
                <Field label="Full name">
                  <input required placeholder="Jordan Avery" style={inputStyle} className="lumina-input" value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                </Field>
                <Field label="Phone number">
                  <input required placeholder="080 000 0000" style={inputStyle} className="lumina-input" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
                <Field label="Delivery address">
                  <input required placeholder="Street address" style={inputStyle} className="lumina-input" value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <input required placeholder="City" style={inputStyle} className="lumina-input" value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </Field>
                  <Field label="State">
                    <input required placeholder="State" style={inputStyle} className="lumina-input" value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })} />
                  </Field>
                </div>
                <Field label="Country">
                  <input required placeholder="Country" style={inputStyle} className="lumina-input" value={form.country}
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

          {/* ---------- RIGHT: ORDER SUMMARY (matches cart's sticky summary card) ---------- */}
          <div className="lg:col-span-5">
            <div
              style={{ background: INVERSE, color: INVERSE_INK, borderRadius: "1.25rem", boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}
              className="sticky top-24 flex flex-col gap-5 p-7"
            >
              <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-xl font-bold">Order summary</h2>

              <div className="flex flex-col gap-3">
                {cartItems.map((i) => (
                  <div key={i.productId} className="flex items-center gap-3">
                    <div style={{ background: `${INVERSE_INK}14`, borderRadius: "0.6rem" }} className="h-12 w-12 flex-shrink-0 overflow-hidden">
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

              <div style={{ borderTop: `1px solid ${INVERSE_INK}22` }} className="flex flex-col gap-2.5 pt-5 text-sm">
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.8 }}>Subtotal</span>
                  <span className="font-semibold">{currency} {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.8 }}>Delivery{selectedZone ? ` (${selectedZone.name})` : ""}</span>
                  <span className="font-semibold">{selectedZone ? `${currency} ${deliveryFee.toLocaleString()}` : "Free / pickup"}</span>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${INVERSE_INK}22` }} className="flex items-end justify-between pt-5">
                <span className="text-base font-semibold">Total</span>
                <span className="text-2xl font-extrabold leading-none">{currency} {total.toLocaleString()}</span>
              </div>

              <button
                type="submit"
                form="checkout-form"
                disabled={isSubmitting}
                style={{ background: ACCENT, color: "#fff", boxShadow: `0 8px 20px ${ACCENT}4d` }}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSubmitting ? "Redirecting to payment…" : `Pay ${currency} ${total.toLocaleString()}`}
              </button>
              <p style={{ opacity: 0.5 }} className="text-center text-[11px] uppercase tracking-widest">Secure payment · Powered by BizNest</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .lumina-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid ${INK}22;
          background: ${SURFACE};
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ opacity: 0.6 }} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { color: INK };
