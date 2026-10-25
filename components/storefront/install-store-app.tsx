"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 4000;

function isStandalone(): boolean {
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac with touch support.
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  // Links opened from Instagram/Facebook/TikTok use an in-app browser that has
  // no "Add to Home Screen", so the instructions would be a dead end there.
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|musical_ly|BytedanceWebview|Snapchat|Line\//i.test(ua);
  return ios && !inApp;
}

/**
 * "Install <Store>" banner for customers. Android/Chrome gets the real install
 * prompt (the store's own manifest supplies its name + logo); iOS has no
 * install API, so it gets the "Share -> Add to Home Screen" instructions.
 * Also registers the store's tiny service worker, which browsers want before
 * they offer installation.
 *
 * `base` is the store's public path prefix ("/<slug>" on biznest.space, "" on
 * a custom domain), `iconSrc` its PNG icon route.
 */
export function InstallStoreApp({ slug, storeName, base, iconSrc }: { slug: string; storeName: string; base: string; iconSrc: string }) {
  const pathname = usePathname() ?? "";
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [ios, setIos] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const key = `bn-store-install-snoozed:${slug}`;
  // Merchant dashboard and checkout flows aren't the place for this.
  const blocked = /\/admin(\/|$)|\/checkout(\/|$)|\/payment(\/|$)/.test(pathname);

  useEffect(() => {
    if (isStandalone()) return;
    setIos(isIos());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
    }

    try {
      const at = Number(localStorage.getItem(key) ?? 0);
      setDismissed(!!at && Date.now() - at < SNOOZE_MS);
    } catch {
      setDismissed(false);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const t = window.setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(t);
    };
  }, [base, key]);

  const canShow = !!deferred || ios;
  if (!ready || dismissed || blocked || !canShow) return null;

  function snooze() {
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch {}
    setDismissed(true);
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      snooze();
    } else {
      setShowSteps(true);
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-sm rounded-2xl border bg-white p-3 text-neutral-900 shadow-xl">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl border" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{storeName}</p>
          <p className="text-xs text-neutral-600">Add our app to your home screen</p>
        </div>
        <button onClick={install} className="shrink-0 rounded-full bg-neutral-900 px-3.5 py-1.5 text-sm font-semibold text-white">
          Install
        </button>
        <button onClick={snooze} aria-label="Dismiss" className="shrink-0 p-1 text-neutral-500 hover:text-neutral-900">
          <X className="h-4 w-4" />
        </button>
      </div>
      {showSteps && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-neutral-100 p-2.5 text-xs leading-snug text-neutral-700">
          <Share className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Tap the <b>Share</b> button in Safari, then choose <b>Add to Home Screen</b>.
          </span>
        </p>
      )}
    </div>
  );
}
