"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { subscribeToPush } from "@/lib/actions/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Mobile-first by design, not just placement: this only renders once we
 * know push is actually usable (SW + PushManager support, permission not
 * already decided), and it's a dismissible inline banner rather than a
 * blocking browser prompt fired on page load — merchants on Android Chrome
 * are used to sites asking immediately and swatting it away out of habit.
 * Asking after they've landed on the dashboard, with context about *why*
 * ("new orders, abandoned carts"), gets a real answer instead of a reflex
 * dismissal.
 */
export function PushSubscribePrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    if (sessionStorage.getItem("bn-push-prompt-dismissed")) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {});
    setVisible(true);
  }, []);

  async function handleEnable() {
    if (!VAPID_PUBLIC_KEY) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }
      // navigator.serviceWorker.ready never resolves if the worker failed
      // to register (e.g. the earlier register() call in the effect above
      // hit a network error, or a stale worker got stuck) -- it just waits
      // forever for a worker that will never activate. That's exactly what
      // left this button stuck on "Enabling..." permanently. A timeout
      // can't make the subscription succeed, but it guarantees the button
      // always recovers instead of hanging, so retrying is at least
      // possible instead of the prompt being silently dead until reload.
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Service worker didn't become ready in time")), 8000)),
      ]);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = subscription.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
      if (json.keys) {
        await subscribeToPush({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent });
      }
    } catch {
      // Swallow and just let finally reset the button -- there's no
      // separate error UI here yet, but "stuck forever" is worse than
      // "silently didn't enable"; the person can just press Enable again.
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }

  function handleDismiss() {
    sessionStorage.setItem("bn-push-prompt-dismissed", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mx-3 mt-3 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 sm:mx-0 sm:mt-0 sm:mb-4">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Turn on notifications</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Get alerted the moment an order comes in or a customer abandons their cart — even
          when the app isn&apos;t open.
        </p>
        <div className="mt-2 flex gap-3">
          <button
            onClick={handleEnable}
            disabled={busy}
            className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Enabling…" : "Enable"}
          </button>
          <button onClick={handleDismiss} className="text-xs text-muted-foreground hover:text-foreground">
            Not now
          </button>
        </div>
      </div>
      <button onClick={handleDismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
