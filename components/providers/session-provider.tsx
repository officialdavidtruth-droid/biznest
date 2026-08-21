"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

/**
 * Thin client wrapper so the root (server) layout can provide a session
 * to client components. Needed for AccountLink's useSession() call in
 * every storefront chrome — without this, useSession() throws
 * "[next-auth]: `useSession` must be wrapped in a <SessionProvider />".
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
