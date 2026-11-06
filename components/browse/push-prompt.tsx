"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { subscribeToPush } from "@/lib/actions/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function keyBytes(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const raw = atob((base64String + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function subscribeAndSave() {
  if (!VAPID_PUBLIC_KEY) return;
  await navigator.serviceWorker.register("/sw.js");
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000))]);
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
  if (json.keys) await subscribeToPush({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent });
}

/** Asks a signed-in follower to allow phone alerts. Only shown while the choice is still open on this device. */
export function BrowsePushPrompt() {
  const [state, setState] = useState<"hidden" | "ask" | "blocked" | "busy">("hidden");

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission === "granted") { subscribeAndSave().catch(() => undefined); return; }
    setState(Notification.permission === "denied" ? "blocked" : "ask");
  }, []);

  if (state === "hidden") return null;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl bg-[#FBF6E9] p-4 text-[#14301A]">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{state === "blocked" ? "Alerts are blocked on this device" : "Get an alert when a business you follow posts"}</p>
        {state === "blocked"
          ? <p className="mt-0.5 text-xs text-[#14301A]/70">Allow notifications for this site in your browser settings, then reload.</p>
          : <button disabled={state === "busy"} className="mt-2 rounded-full bg-[#14301A] px-4 py-1.5 text-xs font-semibold text-[#FBF6E9] disabled:opacity-60"
              onClick={async () => {
                setState("busy");
                try { if ((await Notification.requestPermission()) === "granted") await subscribeAndSave(); } catch { /* the button just resets */ }
                setState("hidden");
              }}>{state === "busy" ? "Turning on…" : "Turn on alerts"}</button>}
      </div>
    </div>
  );
}
