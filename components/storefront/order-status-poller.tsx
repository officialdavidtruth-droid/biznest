"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 30; // ~2 minutes, then stop hammering the server

/**
 * Re-fetches the server-rendered confirmation page until the order leaves
 * PENDING_PAYMENT (the gateway webhook/callback has landed). Once the status
 * changes the page re-renders as the real confirmation and this unmounts.
 */
export function OrderStatusPoller() {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(id);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  if (!gaveUp) return null;
  return (
    <p className="mt-6 text-sm opacity-70" role="status">
      This is taking longer than usual. You can safely close this page. We&apos;ll email you once the payment is confirmed.
    </p>
  );
}
