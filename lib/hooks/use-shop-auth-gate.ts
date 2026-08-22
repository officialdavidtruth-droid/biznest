"use client";

import { useSession } from "next-auth/react";
import { toast } from "sonner";

/**
 * Gates storefront "shopping" actions (add to cart, book a service) behind
 * a signed-in session. Customer accounts are store-scoped (see
 * StoreCustomer / lib/auth.ts), so this always sends people through this
 * store's own branded /login?store=<slug> rather than a generic one — same
 * pattern AccountLink already uses for the header sign-in link.
 *
 * This is a UX front door, not the security boundary: the real enforcement
 * lives server-side (createOrder / createBooking already reject anonymous
 * requests). Gating here just means someone finds out *before* filling out
 * an entire checkout form, not after.
 */
export function useShopAuthGate(storeSlug: string) {
  const { data: session, status } = useSession();

  function requireSignedIn(action: string): boolean {
    if (status === "authenticated" && session?.user) return true;

    if (status !== "loading") {
      toast.message(`Sign in to ${action}`, {
        description: "It only takes a moment to create a free account.",
      });
      const callbackUrl = typeof window !== "undefined" ? window.location.href : `/${storeSlug}`;
      window.location.href = `/login?store=${encodeURIComponent(storeSlug)}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    }
    return false;
  }

  return { requireSignedIn, isLoading: status === "loading", isSignedIn: status === "authenticated" };
}
