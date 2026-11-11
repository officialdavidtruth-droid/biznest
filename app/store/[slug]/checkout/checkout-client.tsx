"use client";

import { ApproxPrice } from "@/components/storefront/approx-price";
import { useEffect, useState } from "react";
import { DEFAULT_STORE_PALETTE, type StorePalette } from "@/lib/store-palette-defaults";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { submitCheckout } from "@/lib/checkout/client";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { getCheckoutWalletBalance } from "@/lib/actions/customer-wallet";
import { DeliveryZoneOptions } from "@/components/checkout/delivery-zone-options";
import { toast } from "sonner";
import { openKorapayInline } from "@/lib/checkout/korapay-inline";
import { fieldStyle, DEFAULT_PAGE_SKIN, LAYOUT_CLASSES, PAD, GAP, RADIUS_PX, BTN_RADIUS, surfaceStyle, summaryStyle } from "@/lib/storefront/page-skin";
import { PageHeading } from "@/components/storefront/page-heading";
import { ShieldCheck, Lock, Truck, ChevronLeft, CreditCard, Wallet } from "lucide-react";
import { formatNumber } from "@/lib/i18n/locale";
import { grossUpForGatewayFee, payoutTransferFee, type FeeConfig } from "@/lib/payments/customer-fee";

declare global {
  interface Window {
    PaystackPop?: new () => { resumeTransaction: (accessCode: string, callbacks?: { onSuccess?: (tx: { reference?: string }) => void; onCancel?: () => void }) => void };
    FlutterwaveCheckout?: (config: Record<string, unknown>) => void;
  }
}

async function loadExternalScript(src: string) {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    if (existing.dataset.loaded === "true") return;
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Payment provider could not be loaded.")), { once: true });
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("Payment provider could not be loaded."));
    document.body.appendChild(script);
  });
}

type Zone = { id: string; name: string; city: string | null; fee: unknown; estimatedMinutes: number | null };

export function CheckoutClient({ slug, palette = DEFAULT_STORE_PALETTE, feeConfig, storeName }: { slug: string; palette?: StorePalette; feeConfig?: FeeConfig; storeName?: string }) {
  const ACCENT = palette.accent, INK = palette.ink, SURFACE = palette.surface, CARD = palette.card, CARD_ALT = palette.cardAlt, INVERSE = palette.inverse, INVERSE_INK = palette.inverseInk;
  const skin = palette.skin ?? DEFAULT_PAGE_SKIN;
  const [GRID, FORM_COL, SUM_COL] = LAYOUT_CLASSES[skin.layout];
  const panel = surfaceStyle(skin, palette.ink, palette.card, palette.surface, palette.accent);
  const sum = summaryStyle(skin, palette);
  const SUM_FG = sum.fg;
  const BTN_BG = skin.summary === "accent" ? palette.onAccent : ACCENT;
  const BTN_FG = skin.summary === "accent" ? ACCENT : palette.onAccent;
  const PADC = PAD[skin.density];
  const inputStyle = fieldStyle(skin, INK, SURFACE, CARD);
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
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");

  const [form, setForm] = useState({
    fullName: "", phone: "", address: "", city: "", state: "", country: "Nigeria",
  });

  useEffect(() => {
    listActiveDeliveryZones(slug).then(setZones);
  }, [slug]);

  // Spendable store-wallet balance (null = signed out / no wallet). The server
  // re-checks everything at payment time; this only decides what to offer.
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [payWith, setPayWith] = useState<"card" | "wallet">("card");
  useEffect(() => {
    getCheckoutWalletBalance(slug).then((w) => setWalletBalance(w ? w.balance : null)).catch(() => setWalletBalance(null));
  }, [slug]);

  const selectedZone = fulfillment === "delivery" ? zones.find((z) => z.id === zoneId) : undefined;
  const deliveryFee = selectedZone ? Number(selectedZone.fee) : 0;
  const total = subtotal + deliveryFee;
  const currency = cartItems[0]?.currency ?? "NGN";
  const walletOffered = walletBalance !== null && currency === "NGN";
  const walletCovers = walletOffered && walletBalance >= total;
  const usingWallet = payWith === "wallet" && walletCovers;
  // The customer covers the gateway's processing fee so the seller receives the full price. Paying from the wallet has none.
  const gatewayFee = feeConfig && currency === "NGN" && !usingWallet
    ? grossUpForGatewayFee(feeConfig.gateway, total, feeConfig.schedule, feeConfig.vatPercent, feeConfig.enabled, payoutTransferFee(total, feeConfig.transfer))
    : { totalNaira: total, feeNaira: 0 };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cartItems.length === 0) return;
    if (zones.length > 0 && fulfillment === "delivery" && !zoneId) {
      toast.error("Choose a delivery area, or switch to pickup.");
      return;
    }

    setIsSubmitting(true);
    const result = await submitCheckout({
      slug,
      items: cartItems,
      deliveryZoneId: fulfillment === "delivery" ? zoneId || undefined : undefined,
      fulfillment: zones.length > 0 ? fulfillment : undefined,
      shippingAddress: form,
      idempotencyKey,
      paymentMethod: usingWallet ? "wallet" : "card",
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.data.inline) {
      try {
        const inline = result.data.inline;
        if (inline.provider === "PAYSTACK" && inline.accessCode) {
          await loadExternalScript("https://js.paystack.co/v2/inline.js");
          if (!window.PaystackPop) throw new Error("Paystack checkout is unavailable. Please try again.");
          const popup = new window.PaystackPop();
          popup.resumeTransaction(inline.accessCode, {
            onSuccess: (tx) => { window.location.assign(`/api/payments/paystack/callback?reference=${encodeURIComponent(tx?.reference || inline.reference)}`); },
            onCancel: () => setIsSubmitting(false),
          });
          return;
        }

        if (inline.provider === "KORAPAY") {
          await openKorapayInline({
            publicKey: inline.publicKey,
            reference: inline.reference,
            amountNaira: inline.amountNaira ?? total,
            email: inline.email,
            name: form.fullName,
            onClose: () => setIsSubmitting(false),
            onFailed: () => { toast.error("Payment failed. Please try again."); setIsSubmitting(false); },
          });
          return;
        }

        if (inline.provider === "FLUTTERWAVE") {
          await loadExternalScript("https://checkout.flutterwave.com/v3.js");
          if (!window.FlutterwaveCheckout) throw new Error("Flutterwave checkout is unavailable. Please try again.");
          window.FlutterwaveCheckout({
            public_key: inline.publicKey,
            tx_ref: inline.reference,
            amount: inline.amountNaira ?? total,
            currency: currency || "NGN",
            payment_options: "card,banktransfer,ussd",
            customer: { email: inline.email, name: form.fullName, phone_number: form.phone },
            subaccounts: inline.subaccountId ? [{ id: inline.subaccountId }] : undefined,
            callback: (response: { transaction_id?: number | string; tx_ref?: string }) => {
              const txRef = encodeURIComponent(response.tx_ref || inline.reference);
              const txId = encodeURIComponent(String(response.transaction_id || ""));
              window.location.assign(`/api/payments/flutterwave/callback?tx_ref=${txRef}&transaction_id=${txId}&status=successful`);
            },
            onclose: () => {
              setIsSubmitting(false);
            },
            customizations: { title: "BizNest", description: "Secure card payment", logo: "" },
          });
          return;
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to open secure card checkout.");
        setIsSubmitting(false);
        return;
      }
    }

    window.location.href = result.data.authorizationUrl;
  }

  if (cartItems.length === 0) {
    return (
      <div style={{ background: SURFACE, minHeight: "100vh" }} className="storefront-root">
        <div style={{ background: CARD, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="mx-auto mt-24 max-w-md px-8 py-14 text-center">
          <p style={{ color: INK, opacity: 0.75 }} className="text-sm">Your cart is empty.</p>
          <Link href={`/store/${slug}`} style={{ color: ACCENT }} className="mt-3 inline-block text-sm font-semibold no-underline hover:opacity-80">
            Continue shopping →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: SURFACE, color: INK, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <div style={{ maxWidth: 1280 }} className="mx-auto px-5 pb-28 pt-10 sm:px-6 lg:py-14">
        <PageHeading
          palette={palette}
          title="Checkout"
          current={1}
          before={
            <Link href={`/store/${slug}/cart`} style={{ color: INK, opacity: 0.6 }} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold no-underline hover:opacity-100">
              <ChevronLeft className="h-3.5 w-3.5" /> Back to cart
            </Link>
          }
        />

        <div className={`${GRID} ${GAP[skin.density]}`}>
          {/* ---------- LEFT: FORM ---------- */}
          <div className={FORM_COL}>
            {zones.length > 0 && (
              <div style={panel} className={`mb-5 ${PADC}`}>
                <div className="mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4" style={{ color: ACCENT }} />
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-base font-bold">Delivery</h2>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Fulfilment method">
                  {(["delivery", "pickup"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={fulfillment === mode}
                      onClick={() => setFulfillment(mode)}
                      style={{ border: `1px solid ${fulfillment === mode ? ACCENT : `${INK}22`}`, background: fulfillment === mode ? `${ACCENT}14` : SURFACE, color: INK }}
                      className="rounded-lg px-4 py-2.5 text-sm font-semibold"
                    >
                      {mode === "delivery" ? "Delivery" : "Pickup"}
                    </button>
                  ))}
                </div>
                {fulfillment === "delivery" ? (
                  <>
                    <label style={{ opacity: 0.6 }} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide">Delivery area</label>
                    <select
                      value={zoneId}
                      onChange={(e) => setZoneId(e.target.value)}
                      required
                      style={{ background: SURFACE, border: `1px solid ${INK}22`, color: INK }}
                      className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#0041C8]"
                    >
                      <option value="">Select delivery area</option>
                      <DeliveryZoneOptions zones={zones} currency={currency} />
                    </select>
                  </>
                ) : (
                  <p style={{ opacity: 0.6 }} className="text-sm">You&apos;ll collect your order from the store — no delivery fee.</p>
                )}
              </div>
            )}

            <div style={panel} className={PADC}>
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

            {walletOffered && (
              <div style={panel} className={`mt-5 ${PADC}`}>
                <div className="mb-4 flex items-center gap-2">
                  <Wallet className="h-4 w-4" style={{ color: ACCENT }} />
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-base font-bold">Payment method</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                  {([
                    ["card", "Card or bank transfer", "Pay securely with your card or bank", CreditCard],
                    ["wallet", "Store wallet", walletCovers ? `Balance ${currency} ${formatNumber(walletBalance ?? 0)}` : `Balance ${currency} ${formatNumber(walletBalance ?? 0)} (not enough)`, Wallet],
                  ] as const).map(([mode, label, hint, Icon]) => {
                    const disabled = mode === "wallet" && !walletCovers;
                    const on = payWith === mode && !disabled;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={disabled}
                        onClick={() => setPayWith(mode)}
                        style={{ border: `1.5px solid ${on ? ACCENT : `${INK}22`}`, background: on ? `${ACCENT}12` : SURFACE, color: INK, opacity: disabled ? 0.55 : 1 }}
                        className="flex items-start gap-3 rounded-xl p-4 text-left transition"
                      >
                        <span style={{ background: on ? ACCENT : `${INK}12`, color: on ? palette.onAccent : INK }} className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{label}</span>
                          <span style={{ opacity: 0.65 }} className="mt-0.5 block text-xs">{hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!walletCovers && (
                  <p style={{ opacity: 0.7 }} className="mt-3 text-xs">
                    Need to top up? <Link href={`/store/${slug}/account/wallet`} style={{ color: ACCENT }} className="font-semibold no-underline hover:opacity-80">Add funds to your wallet</Link>
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs" style={{ opacity: 0.6 }}>
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Encrypted checkout</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Buyer protection</span>
              <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Delivery tracking included</span>
            </div>
          </div>

          {/* ---------- RIGHT: ORDER SUMMARY (matches cart's sticky summary card) ---------- */}
          <div className={SUM_COL}>
            <div
              style={sum.style}
              className="sticky top-24 flex flex-col gap-5 p-7"
            >
              <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-xl font-bold">Order summary</h2>

              <div className="flex flex-col gap-3">
                {cartItems.map((i) => (
                  <div key={i.productId} className="flex items-center gap-3">
                    <div style={{ background: `${SUM_FG}14`, borderRadius: "0.6rem" }} className="h-12 w-12 flex-shrink-0 overflow-hidden">
                      {i.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.name}</p>
                      <p style={{ opacity: 0.6 }} className="text-xs">Qty {i.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold">{i.currency} {formatNumber((i.price * i.quantity))}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: `1px solid ${SUM_FG}22` }} className="flex flex-col gap-2.5 pt-5 text-sm">
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.8 }}>Subtotal</span>
                  <span className="font-semibold">{currency} {formatNumber(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ opacity: 0.8 }}>Delivery{selectedZone ? ` (${selectedZone.name})` : ""}</span>
                  <span className="font-semibold">{selectedZone ? `${currency} ${formatNumber(deliveryFee)}` : "Free / pickup"}</span>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${SUM_FG}22` }} className="flex items-end justify-between pt-5">
                <span className="text-base font-semibold">Total</span>
                <span className="text-2xl font-extrabold leading-none">{currency} {formatNumber(total)}</span>
              </div>
              {gatewayFee.feeNaira > 0 && (
                <div className="flex flex-col gap-1.5 pt-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ opacity: 0.8 }}>Payment and payout fees</span>
                    <span className="font-semibold">{currency} {formatNumber(gatewayFee.feeNaira)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ opacity: 0.8 }}>You pay</span>
                    <span className="font-bold">{currency} {formatNumber(gatewayFee.totalNaira)}</span>
                  </div>
                  <p className="text-[11px]" style={{ opacity: 0.6 }}>The fees go to the payment provider, so the seller receives the full price.</p>
                </div>
              )}
              <ApproxPrice amount={total} currency={currency} />

              <button
                type="submit"
                form="checkout-form"
                disabled={isSubmitting}
                style={{ background: BTN_BG, color: BTN_FG, borderRadius: BTN_RADIUS[skin.radius] }}
                className="mt-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSubmitting ? (usingWallet ? "Paying from wallet…" : "Opening secure card checkout…") : usingWallet ? `Pay ${currency} ${formatNumber(total)} from wallet` : `Pay ${currency} ${formatNumber(gatewayFee.totalNaira)}`}
              </button>
              {feeConfig?.viaPlatform && !usingWallet && (
                <p className="text-center text-[11px] leading-relaxed" style={{ opacity: 0.65 }}>You are paying {storeName ?? "this store"}. Payments are collected securely by BizNest on the store&apos;s behalf, so the payment page may show BizNest or our payment partner. The money goes to {storeName ?? "the store"}.</p>
              )}
              <p className="flex items-center justify-center gap-2 text-center text-[11px] uppercase tracking-widest" style={{ opacity: 0.55 }}><CreditCard className="h-3.5 w-3.5" /> Visa · Mastercard · Verve · Secure card checkout</p>
            </div>
          </div>
        </div>
      </div>

      {/* Phones: keep the total and the pay button in reach without scrolling to the summary. */}
      <div style={{ background: CARD, borderTop: `1px solid ${INK}1a`, boxShadow: "0 -8px 24px rgba(0,0,0,0.08)" }} className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 px-4 py-3 lg:hidden">
        <div className="min-w-0 flex-1">
          <p style={{ opacity: 0.6 }} className="text-[11px] font-semibold uppercase tracking-wide">Total</p>
          <p className="truncate text-lg font-extrabold leading-tight">{currency} {formatNumber(total)}</p>
        </div>
        <button
          type="submit"
          form="checkout-form"
          disabled={isSubmitting}
          style={{ background: ACCENT, color: palette.onAccent, borderRadius: BTN_RADIUS[skin.radius] }}
          className="px-6 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {isSubmitting ? "Please wait…" : usingWallet ? "Pay from wallet" : "Pay now"}
        </button>
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


