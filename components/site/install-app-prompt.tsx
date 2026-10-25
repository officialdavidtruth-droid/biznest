"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "bn-install-dismissed";

/** True when the page is running inside the native BizNest Android app
 *  (the Capacitor shell appends "BizNestApp" to the WebView user agent) or
 *  as an installed PWA. */
export function isRunningAsApp(): boolean {
  if (typeof window === "undefined") return false;
  if (navigator.userAgent.includes("BizNestApp")) return true;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * Small dismissible banner on merchant-facing pages (dashboard, account)
 * that points people at the installable app. Hidden inside the app itself
 * and once dismissed. Also registers the (push-only) service worker so the
 * browser treats the site as installable even before push is enabled.
 */
export function InstallAppPrompt() {
  const pathname = usePathname() ?? "";
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  const relevant = /\/admin(\/|$)|\/account(\/|$)|^\/onboarding/.test(pathname);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (!relevant || isRunningAsApp()) return setVisible(false);
    try {
      if (localStorage.getItem(DISMISS_KEY)) return setVisible(false);
    } catch {}
    setVisible(true);
  }, [relevant, pathname]);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      dismiss();
    } else {
      window.location.href = "/download";
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#0f6410] p-3 pl-4 text-white shadow-lg">
      <Download className="h-5 w-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm leading-snug">Get the BizNest app for faster access to your store.</p>
      <button
        onClick={install}
        className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-[#0f6410]"
      >
        Install
      </button>
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 p-1 opacity-80 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
