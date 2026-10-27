"use client";

/**
 * Opens Korapay's in-page payment popup (same job as PaystackPop /
 * FlutterwaveCheckout in the other branches). On success the browser goes to
 * our /api/payments/korapay/callback, which RE-VERIFIES the payment with Kora
 * before settling anything -- the popup's success event is never trusted.
 */
import { parseKorapayChannels } from "@/lib/payments/korapay-channels";

const KORA_SCRIPT = "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";

type KoraWindow = Window & {
  Korapay?: { initialize: (config: Record<string, unknown>) => void };
};

async function loadKoraScript() {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${KORA_SCRIPT}"]`);
  if (existing) {
    if (existing.dataset.loaded === "true") return;
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Korapay could not be loaded.")), { once: true });
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = KORA_SCRIPT;
    script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("Korapay could not be loaded."));
    document.body.appendChild(script);
  });
}

export async function openKorapayInline(params: {
  publicKey: string;
  reference: string;
  amountNaira: number;
  email: string;
  name?: string;
  /** Called when the customer closes the popup without paying. */
  onClose?: () => void;
  /** Called when Kora reports the payment failed. */
  onFailed?: () => void;
}) {
  await loadKoraScript();
  const kora = (window as KoraWindow).Korapay;
  if (!kora) throw new Error("Korapay checkout is unavailable. Please try again.");
  kora.initialize({
    key: params.publicKey,
    reference: params.reference,
    amount: params.amountNaira,
    currency: "NGN",
    // Bank transfer / Pay with Bank first: card payments often stall on the OTP step.
    channels: parseKorapayChannels(process.env.NEXT_PUBLIC_KORAPAY_CHANNELS),
    customer: { name: params.name || params.email, email: params.email },
    onClose: () => params.onClose?.(),
    onSuccess: () => {
      window.location.assign(`/api/payments/korapay/callback?reference=${encodeURIComponent(params.reference)}`);
    },
    onFailed: () => params.onFailed?.(),
  });
}
