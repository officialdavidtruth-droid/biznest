"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { User } from "lucide-react";

/**
 * Storefront header "sign in / account" entry point. Sits next to
 * CartLink in every template's chrome. Customer accounts are just regular
 * BizNest User rows (shared across the whole platform — see
 * prisma/migrations/20260810010000_customer_account_system), and the
 * session cookie is domain-scoped to ".biznest.space" (lib/auth.config.ts),
 * so a login on one store subdomain is already valid on any other. What
 * was missing was simply a link to get there from inside a storefront —
 * every template had a CartLink but nothing that pointed at /login or
 * /register, so a shopper had no way to discover or use the account
 * system while browsing a store.
 *
 * callbackUrl is this store's own host+path, so after signing in (or
 * creating an account) the customer is dropped right back where they were
 * instead of on the root biznest.space marketing site.
 */
export function AccountLink({
  storeSlug,
  ink = "#141D23",
}: {
  storeSlug: string;
  ink?: string;
}) {
  const { data: session, status } = useSession();

  if (status === "authenticated" && session?.user) {
    return (
      <Link
        href={`/${storeSlug}/orders`}
        className="flex items-center"
        aria-label="My account"
        title="My orders"
      >
        <User className="h-5 w-5 transition-colors" style={{ color: ink, opacity: 0.85 }} />
      </Link>
    );
  }

  const callbackUrl =
    typeof window !== "undefined" ? window.location.href : `/${storeSlug}`;

  return (
    <Link
      href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
      className="flex items-center"
      aria-label="Sign in"
      title="Sign in"
    >
      <User className="h-5 w-5 transition-colors" style={{ color: ink, opacity: 0.85 }} />
    </Link>
  );
}
