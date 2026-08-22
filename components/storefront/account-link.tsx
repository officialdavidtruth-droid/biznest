"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { User } from "lucide-react";

/**
 * Storefront header "sign in / account" entry point. Sits next to
 * CartLink in every template's chrome. Customer accounts are now
 * store-scoped (see StoreCustomer / prisma/migrations/20260821120000_
 * store_scoped_customers) — signing up on Store A does not grant access
 * to Store B — so "my orders" is naturally this store's own themed
 * /{storeSlug}/orders page, not a generic cross-store biznest.space/orders
 * feed.
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
        href={`/${storeSlug}/account`}
        className="flex items-center"
        aria-label="My account"
        title="My account"
      >
        <User className="h-5 w-5 transition-colors" style={{ color: ink, opacity: 0.85 }} />
      </Link>
    );
  }

  const callbackUrl =
    typeof window !== "undefined" ? window.location.href : `/${storeSlug}`;

  // storeSlug is passed separately from callbackUrl (rather than parsed
  // back out of it) so the login/register pages can look up and show this
  // store's branding without having to re-derive the slug from a URL that
  // might be a path (biznest.space/<slug>) or a vendor's own custom
  // domain host.
  return (
    <Link
      href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}&store=${encodeURIComponent(storeSlug)}`}
      className="flex items-center"
      aria-label="Sign in"
      title="Sign in"
    >
      <User className="h-5 w-5 transition-colors" style={{ color: ink, opacity: 0.85 }} />
    </Link>
  );
}
