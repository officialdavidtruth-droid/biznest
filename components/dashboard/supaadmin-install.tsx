"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Registers the SupaAdmin service worker (scope /supaadmin/) and shows an
 * "Install app" button in the header until the app is installed. Chrome/Android
 * gets the native install prompt; iOS has no such API, so it gets a short
 * "Add to Home Screen" hint instead. Renders nothing once running as the app.
 */
export function SupaAdminInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(true); // hidden until we know
  const [ios, setIos] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIos());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/supaadmin/sw.js", { scope: "/supaadmin/" }).catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || (!deferred && !ios)) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else {
      setShowHint((v) => !v);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={install}
        className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
        style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
      >
        <Download size={12} aria-hidden />
        Install app
      </button>
      {showHint && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border p-3 text-xs shadow-lg"
          style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
        >
          <button onClick={() => setShowHint(false)} className="absolute right-2 top-2" aria-label="Close">
            <X size={14} />
          </button>
          <p className="pr-4 leading-snug">
            Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b> to install SupaAdmin.
          </p>
        </div>
      )}
    </div>
  );
}
