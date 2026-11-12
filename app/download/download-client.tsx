"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, Monitor, Laptop, Share, PlusSquare, CheckCircle2 } from "lucide-react";
import { isRunningAsApp } from "@/components/site/install-app-prompt";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "android" | "ios" | "windows" | "mac" | "linux" | "desktop";

export function DownloadClient({ apkUrl }: { apkUrl: string }) {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) setPlatform("android");
    else if (/iphone|ipad|ipod/i.test(ua)) setPlatform("ios");
    else if (/windows/i.test(ua)) setPlatform("windows");
    else if (/macintosh|mac os x/i.test(ua)) setPlatform("mac");
    else if (/linux/i.test(ua)) setPlatform("linux");
    setInstalled(isRunningAsApp());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installPwa() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (installed) {
    return (
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
        <CheckCircle2 className="h-6 w-6 shrink-0" />
        <p className="text-sm">You&apos;re already using the BizNest app.</p>
      </div>
    );
  }

  const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm";
  const primary =
    "inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0f6410] px-5 py-3 text-sm font-semibold text-white active:opacity-90";

  const secondary =
    "inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#0f6410] px-5 py-3 text-sm font-semibold text-[#0f6410] active:opacity-90";

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <section className={`${card} ${platform === "android" ? "ring-2 ring-[#0f6410]" : ""}`}>
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <Smartphone className="h-5 w-5 text-[#0f6410]" /> Android app
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Download the APK and open it to install. If your phone asks, allow installs from your browser
          (Settings → Install unknown apps).
        </p>
        <a href={apkUrl} className={primary} download>
          <Download className="h-4 w-4" /> Download for Android (.apk)
        </a>
      </section>

      <section className={`${card} ${platform === "windows" || platform === "mac" || platform === "linux" ? "ring-2 ring-[#0f6410]" : ""}`}>
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <Laptop className="h-5 w-5 text-[#0f6410]" /> Computer app (Windows, Mac, Linux)
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Your store, orders and bookings in their own window. It includes an offline register: keep selling when the internet drops, and your sales are recorded automatically when it returns.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {/* Route handler that redirects to the installer, not a page: a plain <a> is correct. */}
          {/* eslint-disable @next/next/no-html-link-for-pages */}
          <a href="/download/desktop/windows" className={platform === "windows" ? primary : secondary}><Download className="h-4 w-4" /> Windows</a>
          <a href="/download/desktop/mac" className={platform === "mac" ? primary : secondary}><Download className="h-4 w-4" /> Mac</a>
          <a href="/download/desktop/linux" className={platform === "linux" ? primary : secondary}><Download className="h-4 w-4" /> Linux</a>
          {/* eslint-enable @next/next/no-html-link-for-pages */}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Windows may show &quot;Windows protected your PC&quot;: choose <em>More info → Run anyway</em>. On Mac, right-click the app and choose <em>Open</em> the first time.
        </p>
      </section>

      <section className={`${card} ${platform !== "android" && deferred ? "ring-2 ring-[#0f6410]" : ""}`}>
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <Monitor className="h-5 w-5 text-[#0f6410]" /> Install from your browser
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Works on Android, Windows, Mac and Chromebook. It opens in its own window with its own icon, no app store needed.
        </p>
        {deferred ? (
          <button onClick={installPwa} className={primary}>
            <Download className="h-4 w-4" /> Install BizNest
          </button>
        ) : (
          <p className="text-sm text-gray-500">
            Open this page in Chrome or Edge and use the browser menu → <em>Install app</em>.
          </p>
        )}
      </section>

      <section className={`${card} ${platform === "ios" ? "ring-2 ring-[#0f6410]" : ""}`}>
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <Share className="h-5 w-5 text-[#0f6410]" /> iPhone &amp; iPad
        </div>
        <ol className="space-y-2 text-sm text-gray-600">
          <li>1. Open biznest.space in <strong>Safari</strong>.</li>
          <li className="flex items-center gap-1.5">2. Tap the <Share className="inline h-4 w-4" /> Share button.</li>
          <li className="flex items-center gap-1.5">3. Choose <PlusSquare className="inline h-4 w-4" /> <strong>Add to Home Screen</strong>.</li>
        </ol>
      </section>
    </div>
  );
}
