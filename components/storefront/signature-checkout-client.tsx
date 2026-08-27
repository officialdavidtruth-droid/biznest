"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, ShieldCheck, Truck, CreditCard, CalendarDays, MapPin } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { submitCheckout } from "@/lib/checkout/client";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { DeliveryZoneOptions } from "@/components/checkout/delivery-zone-options";
import { getSignatureTheme } from "@/lib/template-themes";
import { toast } from "sonner";

type Mode = "electra" | "atelier" | "kinetic" | "bloom" | "haven" | "harvest" | "maison" | "hotel" | "ember" | "muse" | "frame" | "north" | "pure" | "forge";

type Zone = { id: string; name: string; fee: number | string | { toString(): string } };

const modeMeta: Record<Mode, { kicker: string; title: string; action: string; summary: string; labels: [string, string, string]; dark?: boolean }> = {
  electra: { kicker: "Secure checkout", title: "Finish your order.", action: "Continue to secure payment", summary: "Your tech, ready for the next step.", labels: ["Cart", "Details", "Payment"] },
  atelier: { kicker: "The final edit", title: "Complete your purchase.", action: "Continue to payment", summary: "A considered finish to your order.", labels: ["Edit", "Details", "Payment"] },
  kinetic: { kicker: "Drop checkout", title: "Lock it in.", action: "Proceed to payment", summary: "Your pair is held while you complete payment.", labels: ["Drop", "Details", "Payment"], dark: true },
  bloom: { kicker: "Your ritual", title: "Complete your order.", action: "Continue to secure payment", summary: "Almost ready for your next ritual.", labels: ["Bag", "Details", "Payment"] },
  haven: { kicker: "Your home edit", title: "Bring it home.", action: "Continue to payment", summary: "A considered delivery for your space.", labels: ["Selection", "Delivery", "Payment"] },
  harvest: { kicker: "Fresh to your door", title: "Complete your basket.", action: "Continue to payment", summary: "A few details and your groceries are on their way.", labels: ["Basket", "Delivery", "Payment"] },
  maison: { kicker: "Direct booking", title: "Complete your stay.", action: "Continue to secure payment", summary: "Your stay is almost confirmed.", labels: ["Stay", "Guest details", "Payment"] },
  hotel: { kicker: "Guest journey", title: "Complete your reservation.", action: "Continue to payment", summary: "A few details before we welcome you.", labels: ["Stay", "Guest", "Payment"] },
  ember: { kicker: "Tonight's table", title: "Complete your order.", action: "Continue to payment", summary: "Good food is only a few details away.", labels: ["Menu", "Details", "Payment"], dark: true },
  muse: { kicker: "Your appointment", title: "Complete your booking.", action: "Continue to payment", summary: "Your time is reserved once payment is confirmed.", labels: ["Service", "Details", "Payment"] },
  frame: { kicker: "Session booking", title: "Make it official.", action: "Continue to payment", summary: "Your session details are ready for confirmation.", labels: ["Package", "Details", "Payment"] },
  north: { kicker: "Start a project", title: "Let's make it happen.", action: "Continue to secure payment", summary: "Your project details are ready for the next step.", labels: ["Scope", "Details", "Payment"] },
  pure: { kicker: "Book with confidence", title: "Complete your booking.", action: "Continue to payment", summary: "A cleaner space starts with these details.", labels: ["Service", "Address", "Payment"] },
  forge: { kicker: "Project checkout", title: "Ready to build.", action: "Continue to secure payment", summary: "Confirm the details for your project.", labels: ["Project", "Details", "Payment"] },
};

function Field({ label, value, onChange, placeholder, required = true }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; required?: boolean }) {
  return <label className="block">
    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] opacity-60">{label}</span>
    <input required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="signature-checkout-input w-full" />
  </label>;
}

export function SignatureCheckoutClient({ slug, templateName }: { slug: string; templateName: string }) {
  const theme = getSignatureTheme(templateName);
  const mode = theme.signatureMode as Mode;
  const meta = modeMeta[mode] ?? modeMeta.electra;
  const { items, storeSlug, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", city: "", state: "", country: "Nigeria" });
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => { listActiveDeliveryZones(slug).then(setZones).catch(() => setZones([])); }, [slug]);

  const selectedZone = zones.find((z) => z.id === zoneId);
  const deliveryFee = selectedZone ? Number(selectedZone.fee) : 0;
  const total = subtotal + deliveryFee;
  const currency = cartItems[0]?.currency ?? "NGN";
  const isDark = meta.dark;
  const styles = useMemo(() => ({
    "--sig-bg": theme.bg,
    "--sig-ink": theme.ink,
    "--sig-card": theme.card,
    "--sig-accent": theme.accent,
    "--sig-muted": theme.muted,
    "--sig-border": theme.border,
    "--sig-dark": theme.surfaceDark,
    "--sig-radius": theme.radius,
  } as React.CSSProperties), [theme]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cartItems.length) return;
    setIsSubmitting(true);
    try {
      const result = await submitCheckout({ slug, items: cartItems, deliveryZoneId: zoneId || undefined, shippingAddress: form, idempotencyKey });
      if (!result.success) { toast.error(result.error); return; }
      window.location.assign(result.data.authorizationUrl);
    } catch { toast.error("We couldn't start payment. Please try again."); }
    finally { setIsSubmitting(false); }
  }

  if (!cartItems.length) return <main data-signature-mode={mode} style={styles} className="signature-checkout mx-auto min-h-[55vh] max-w-2xl px-5 py-24 text-center">
    <div className="signature-checkout-card mx-auto max-w-md p-10">
      <p className="signature-eyebrow">{meta.kicker}</p><h1 className="signature-title mt-3">Your bag is empty.</h1>
      <Link href={`/store/${slug}`} className="signature-primary-button mt-7 inline-flex">Back to store</Link>
    </div>
  </main>;

  return <main data-signature-mode={mode} style={styles} className={`signature-checkout ${isDark ? "signature-dark" : ""}`}>
    <div className="mx-auto max-w-7xl px-5 py-7 md:px-8 md:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
        <Link href={`/store/${slug}/cart`} className="signature-back"><ArrowLeft className="h-4 w-4" /> Back to cart</Link>
        <div className="signature-steps" aria-label="Checkout progress">
          {meta.labels.map((label, i) => <span key={label} className={i < 2 ? "is-active" : ""}><b>{i + 1}</b>{label}{i < 2 && <i>—</i>}</span>)}
        </div>
      </div>

      <header className="mb-10 max-w-3xl">
        <p className="signature-eyebrow">{meta.kicker}</p>
        <h1 className="signature-title mt-2">{meta.title}</h1>
        <p className="signature-subtitle mt-3">{meta.summary}</p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-5">
          {zones.length > 0 && <section className="signature-checkout-card p-6 md:p-8">
            <div className="mb-5 flex items-center gap-3"><Truck className="h-5 w-5" /><div><h2 className="signature-section-title">Delivery</h2><p className="signature-helper">Choose how you'd like to receive your order.</p></div></div>
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="signature-checkout-input w-full"><option value="">Pickup / no delivery fee</option><DeliveryZoneOptions zones={zones} /></select>
          </section>}

          <section className="signature-checkout-card p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3"><MapPin className="h-5 w-5" /><div><h2 className="signature-section-title">{mode === "maison" || mode === "hotel" ? "Guest details" : "Your details"}</h2><p className="signature-helper">Used only to complete this order.</p></div></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} placeholder="Your full name" />
              <Field label="Phone number" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="080 000 0000" />
              <div className="sm:col-span-2"><Field label={mode === "forge" || mode === "north" ? "Project / delivery address" : "Address"} value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="Street address" /></div>
              <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="City" />
              <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} placeholder="State" />
              <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} placeholder="Country" />
            </div>
          </section>

          <section className="signature-trust flex flex-wrap gap-x-7 gap-y-3 px-1 py-2 text-xs"><span><Lock /> Secure checkout</span><span><ShieldCheck /> Protected payment</span><span><CreditCard /> Card / bank payment</span></section>
        </div>

        <aside className="signature-checkout-card signature-summary h-fit p-6 md:p-7 lg:sticky lg:top-6">
          <div className="mb-6 flex items-start justify-between gap-4"><div><p className="signature-eyebrow">Your selection</p><h2 className="signature-section-title mt-1">Order summary</h2></div><span className="signature-summary-count">{cartItems.length} {cartItems.length === 1 ? "item" : "items"}</span></div>
          <div className="space-y-4">
            {cartItems.map((item) => <div key={item.productId} className="flex gap-3">
              <div className="signature-product-image">{item.image && <img src={item.image} alt="" />}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="signature-helper mt-1">Qty {item.quantity}</p></div>
              <span className="text-sm font-bold">{item.currency} {(item.price * item.quantity).toLocaleString()}</span>
            </div>)}
          </div>
          <div className="signature-total-block mt-7 space-y-3 border-t pt-5">
            <div className="flex justify-between text-sm"><span className="signature-helper">Subtotal</span><span>{currency} {subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm"><span className="signature-helper">Delivery{selectedZone ? ` · ${selectedZone.name}` : ""}</span><span>{selectedZone ? `${currency} ${deliveryFee.toLocaleString()}` : "Free / pickup"}</span></div>
            <div className="flex items-end justify-between border-t pt-5"><span className="signature-section-title">Total</span><span className="signature-total">{currency} {total.toLocaleString()}</span></div>
          </div>
          <button disabled={isSubmitting} type="submit" className="signature-primary-button mt-6 w-full">{isSubmitting ? "Preparing secure payment…" : meta.action}</button>
          <p className="signature-payment-note mt-4 text-center">You'll be redirected to the secure payment provider to complete payment.</p>
        </aside>
      </form>
    </div>
  </main>;
                                                                       }
                                                                                                                                              
