"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { unsubscribeStoreCustomerFromPush } from "@/lib/actions/store-customer-push";

export function StoreCustomerSignOutButton({
  storeSlug,
  className,
  children,
}: {
  storeSlug: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    try {
      // Stop order pushes on this device while we can still authenticate.
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            const sub = await reg.pushManager?.getSubscription();
            if (!sub) continue;
            const res = await unsubscribeStoreCustomerFromPush(storeSlug, sub.endpoint);
            if (res.success && res.data.removed) await sub.unsubscribe();
          }
        }
      } catch {}
      await fetch("/api/store-auth", {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      router.replace(`/${encodeURIComponent(storeSlug)}`);
      router.refresh();
    }
  }

  return (
    <button type="button" disabled={pending} onClick={handleSignOut} className={className}>
      {children ?? "Sign out"}
    </button>
  );
}
