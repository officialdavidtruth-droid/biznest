"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { subscribeToPush, sendTestPush } from "@/lib/actions/push";

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
async function readyRegistration() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Service worker didn't become ready in time")), 8000)),
  ]);
}

/** Subscribes this device (reusing an existing subscription) and saves it for the signed-in user. */
async function subscribeAndSave() {
  if (!VAPID_PUBLIC_KEY) return;
  const registration = await readyRegistration();
  const expectedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  let existing = await registration.pushManager.getSubscription();
  // A subscription made under an older VAPID public key is rejected by the push service
  // (Apple answers 400 VapidPkHashMismatch), so drop it and subscribe again with the current key.
  if (existing) {
    const current = existing.options?.applicationServerKey;
    const same =
      !current ||
      (current.byteLength === expectedKey.length && new Uint8Array(current).every((b, i) => b === expectedKey[i]));
    if (!same) {
      await existing.unsubscribe().catch(() => {});
      existing = null;
    }
  }
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expectedKey,
    }));
  const json = subscription.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
  if (json.keys) await subscribeToPush({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent });
}

export function PushSubscribePrompt() {
  const [visible, setVisible] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      // Re-sync this device first so a stale or missing subscription is fixed before testing.
      await subscribeAndSave();
      const res = await sendTestPush();
      setTestResult(res.success ? { ok: true, text: res.data.message } : { ok: false, text: res.error });
    } catch (err) {
      setTestResult({ ok: false, text: err instanceof Error ? err.message : "Could not send the test." });
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {});

    // Already allowed on this device: make sure it is really subscribed and saved against this
    // account (covers a new login, cleared data, or an earlier save that failed). No prompt needed.
    if (Notification.permission === "granted") {
      setGranted(true);
      if (!sessionStorage.getItem("bn-push-synced")) {
        sessionStorage.setItem("bn-push-synced", "1");
        subscribeAndSave().catch(() => sessionStorage.removeItem("bn-push-synced"));
      }
      return;
    }
    // Blocked in the browser: the site can't re-ask, so tell the vendor how to turn it back on.
    if (Notification.permission === "denied") {
      if (!sessionStorage.getItem("bn-push-prompt-dismissed")) {
        setBlocked(true);
        setVisible(true);
      }
      return;
    }
    if (sessionStorage.getItem("bn-push-prompt-dismissed")) return;
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
      // subscribeAndSave times out instead of hanging if the service worker never becomes ready,
      // so the button always recovers and can be pressed again.
      await subscribeAndSave();
      setGranted(true);
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

  if (!visible && granted) {
    return (
      <div className="mx-3 mt-3 rounded-xl border p-3 sm:mx-0 sm:mt-0 sm:mb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Notifications are allowed on this device.</p>
          <button
            onClick={handleTest}
            disabled={testing}
            className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {testing ? "Sending…" : "Send test"}
          </button>
        </div>
        {testResult && (
          <p className={`mt-2 text-xs ${testResult.ok ? "text-green-600" : "text-destructive"}`}>{testResult.text}</p>
        )}
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div className="mx-3 mt-3 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 sm:mx-0 sm:mt-0 sm:mb-4">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{blocked ? "Notifications are blocked" : "Turn on notifications"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {blocked
            ? "You won't be alerted when a customer pays or uploads proof of payment. Allow notifications for this site in your browser's site settings (the lock icon next to the address), then reload."
            : "Get alerted the moment a customer pays, uploads proof of payment, places an order or abandons their cart, even when the app isn't open."}
        </p>
        <div className="mt-2 flex gap-3">
          {!blocked && (
            <button
              onClick={handleEnable}
              disabled={busy}
              className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Enabling…" : "Enable"}
            </button>
          )}
          <button onClick={handleDismiss} className="text-xs text-muted-foreground hover:text-foreground">
            {blocked ? "Dismiss" : "Not now"}
          </button>
        </div>
      </div>
      <button onClick={handleDismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
