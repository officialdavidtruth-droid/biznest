"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { subscribeStoreCustomerToPush } from "@/lib/actions/store-customer-push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Opt-in banner for signed-in customers: "tell me when my order moves".
 * Only shown on the customer's account/orders pages (never during checkout),
 * only once push is actually usable, and only when permission is undecided.
 * Subscribes through the store's own service worker (scope `${base}/`), which
 * is where the push handler lives.
 */
export function OrderPushPrompt({ slug, base }: { slug: string; base: string }) {
  const pathname = usePathname() ?? "";
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = `bn-order-push-dismissed:${slug}`;
  const relevant = /\/(account|orders)(\/|$)/.test(pathname);

  useEffect(() => {
    if (!relevant || !VAPID_PUBLIC_KEY) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(key)) return;
    } catch {}
    setVisible(true);
  }, [relevant, key]);

  async function enable() {
    if (!VAPID_PUBLIC_KEY) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }
      await navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = subscription.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
      if (!json.keys) throw new Error("no keys");
      const result = await subscribeStoreCustomerToPush(slug, {
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      });
      if (!result.success) throw new Error(result.error);
      setVisible(false);
    } catch {
      setError("Couldn't turn on notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(key, "1");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-sm rounded-2xl border bg-white p-3 text-neutral-900 shadow-xl">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Get order updates</p>
          <p className="mt-0.5 text-xs text-neutral-600">We&apos;ll notify you when your order is being prepared, ready, or completed.</p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-2 flex gap-3">
            <button
              onClick={enable}
              disabled={busy}
              className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Enabling…" : "Turn on"}
            </button>
            <button onClick={dismiss} className="text-xs text-neutral-500 hover:text-neutral-900">
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 p-1 text-neutral-500 hover:text-neutral-900">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
