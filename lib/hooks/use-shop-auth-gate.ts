"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getStoreCustomerSignedInStatus } from "@/lib/actions/store-customer-session-status";

/**
 * Gates storefront "shopping" actions (add to cart, book a service) behind
 * a signed-in session.
 *
 * IMPORTANT: this checks the store-customer cookie (bn-store-customer),
 * scoped to *this* store — not next-auth's useSession(). Customer logins
 * are their own separate, HMAC-signed cookie system (see
 * lib/store-customer-auth.ts) set with `path: "/"`, so it's carried to
 * every storefront on the domain. A customer signed in on Store A still
 * has that cookie when browsing Store B; useSession() would also reflect
 * an unrelated platform (vendor/staff/admin) login if one exists in the
 * same browser. Either case previously made isSignedIn lie about whether
 * someone was actually a signed-in customer *of this store*, which hid
 * the guest-checkout fields for people who couldn't actually complete a
 * booking as a "signed in" customer, with no fallback.
 *
 * This is a UX front door, not the security boundary: the real enforcement
 * lives server-side (createOrder / createBooking already reject anonymous
 * or cross-store requests). Gating here just means someone finds out
 * *before* filling out an entire checkout form, not after.
 */
export function useShopAuthGate(storeSlug: string) {
  const [status, setStatus] = useState<"loading" | "signed-in" | "signed-out">("loading");

  const refresh = useCallback(() => {
    let cancelled = false;
    setStatus("loading");
    getStoreCustomerSignedInStatus(storeSlug)
      .then((result) => {
        if (!cancelled) setStatus(result.signedIn ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (!cancelled) setStatus("signed-out");
      });
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  useEffect(() => refresh(), [refresh]);

  function requireSignedIn(action: string): boolean {
    if (status === "signed-in") return true;

    if (status !== "loading") {
      toast.message(`Sign in to ${action}`, {
        description: "It only takes a moment to create a free account.",
      });
      const callbackUrl = typeof window !== "undefined" ? window.location.href : `/${storeSlug}`;
      window.location.href = `/login?store=${encodeURIComponent(storeSlug)}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    }
    return false;
  }

  return {
    requireSignedIn,
    isLoading: status === "loading",
    isSignedIn: status === "signed-in",
    refresh,
  };
}
