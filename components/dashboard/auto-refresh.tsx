"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-runs the current server component on an interval so new data (e.g. a
 * customer's message) appears without a manual reload. Client state such as a
 * half-typed reply is preserved by router.refresh().
 *
 * Polls only while the tab is visible and online, and refreshes immediately
 * when the user returns to the tab, so a backgrounded tab costs nothing.
 */
export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    };
    const id = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [router, intervalMs]);

  return null;
}
