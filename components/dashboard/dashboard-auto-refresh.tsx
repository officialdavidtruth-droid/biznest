"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 30_000;
const MIN_GAP_MS = 5_000;

/**
 * Keeps the dashboard current without a manual reload: re-fetches the server
 * data (orders, payments, the notification bell) every 30 seconds while the tab
 * is visible, immediately when the vendor comes back to the tab, and the
 * moment a push notification arrives (the service worker pings open tabs).
 * Client state is preserved by router.refresh(). It skips a tick while the
 * vendor is typing in a field so a form is never disturbed mid-edit.
 */
export function DashboardAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();

    function typing() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
    }

    function refresh(force = false) {
      if (document.hidden) return;
      if (!force && typing()) return;
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      router.refresh();
    }

    const timer = window.setInterval(() => refresh(), INTERVAL_MS);
    const onVisible = () => refresh(true);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "bn-push") refresh(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
