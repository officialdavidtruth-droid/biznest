"use server";

import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";

/**
 * The only reliable way for a client component to know "is this browser
 * signed in as a customer of *this specific store*".
 *
 * Store-customer logins use their own HMAC-signed `bn-store-customer`
 * cookie (see lib/store-customer-auth.ts) — a completely separate system
 * from NextAuth, set with `path: "/"`, so the same cookie travels to
 * every storefront on the domain. A customer signed in on Store A still
 * carries that cookie when they browse Store B.
 *
 * Client code must NOT infer "signed in" from next-auth's useSession():
 * that reflects the platform account (vendor/staff/admin) if any, which
 * has nothing to do with store-customer login, and would either falsely
 * show someone as signed in (hiding guest checkout fields) or falsely
 * show them as signed out. This action asks the server to check the
 * actual store-customer cookie against the actual store, the same way
 * getStoreCustomerSessionForStore is already used for payment
 * verification, so the client gets a true answer scoped to this store.
 */
export async function getStoreCustomerSignedInStatus(
  storeSlug: string
): Promise<{ signedIn: boolean; email: string | null; name: string | null }> {
  const session = await getStoreCustomerSessionForStore(storeSlug);
  if (!session) return { signedIn: false, email: null, name: null };
  return { signedIn: true, email: session.user.email, name: session.user.name };
}
