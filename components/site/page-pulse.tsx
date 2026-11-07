"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Sends one tiny, fire-and-forget page-view ping per page the visitor opens. Renders nothing. */
export function PagePulse() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    if (/^\/(supaadmin|api)(\/|$)/.test(pathname)) return;
    last.current = pathname;
    try {
      const body = JSON.stringify({ path: pathname });
      if (!(navigator.sendBeacon && navigator.sendBeacon("/api/track/page", new Blob([body], { type: "application/json" })))) {
        void fetch("/api/track/page", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
      }
    } catch {
      // ignore
    }
  }, [pathname]);

  return null;
}
