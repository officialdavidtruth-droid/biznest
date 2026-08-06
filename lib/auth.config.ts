import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

/**
 * Edge-safe base config. This file (and everything it imports) must never
 * touch Prisma, bcrypt, or anything else that requires the Node.js runtime.
 *
 * Why this file exists: Next.js Middleware always runs on the Edge Runtime —
 * that's not configurable. `lib/auth.ts` (the full config, with the Prisma
 * adapter and DB-backed callbacks) previously was imported directly into
 * middleware.ts, which meant every middleware invocation tried to run
 * Prisma queries on the Edge and crashed with
 * "PrismaClient is not configured to run in Edge Runtime" — breaking
 * sign-in sitewide. This split is the pattern Auth.js documents for exactly
 * this situation: https://authjs.dev/guides/edge-compatibility
 *
 * `middleware.ts` builds its own lightweight `auth()` from *only* this
 * config — just enough to decode the JWT and read `role` off it, no DB
 * access. `lib/auth.ts` spreads this config and adds the Prisma-dependent
 * pieces (adapter, Credentials provider, the DB role re-check) for use in
 * Server Components, Route Handlers, and Server Actions, which all run on
 * the Node.js runtime by default in this app.
 *
 * Trade-off worth knowing: middleware's role check (used only as a coarse
 * pre-filter for /admin and /supaadmin) now reads whatever role is baked
 * into the JWT, which can lag a promotion/ban by up to a session refresh —
 * same as before the round-3 fix. The real, authoritative check still
 * happens in `app/supaadmin/layout.tsx` via the full `lib/auth.ts`, which
 * does re-check the DB (safely, since layouts run on Node.js). So a fresh
 * promotion might bounce off middleware once before working — a much
 * smaller and more tolerable issue than the sitewide crash this replaces.
 */
// AUTH_URL is only set to the real biznest.space production URL (see
// .env.example) — unset on localhost and on Vercel preview deployments.
const isBizNestProd = process.env.AUTH_URL?.endsWith("biznest.space") ?? false;

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // /supaadmin is just a path on the main site now, so a host-scoped cookie
  // already works for it. We still scope the cookie to ".biznest.space"
  // (rather than the default host-only) so a session stays valid if any
  // other subdomain is added later — harmless today, cheap insurance later.
  // Only done in production: a fixed domain here would silently break auth
  // on localhost and on *.vercel.app preview deployments.
  cookies: isBizNestProd
    ? {
        sessionToken: {
          name: "__Secure-authjs.session-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: true,
            domain: ".biznest.space",
          },
        },
      }
    : undefined,
  providers: [], // Real providers only exist in lib/auth.ts (Node-only: Credentials needs bcrypt+Prisma).
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      // No DB re-check here — see file header. lib/auth.ts adds that.
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
    // NextAuth's built-in default here only allows a redirect target whose
    // origin exactly matches `baseUrl` (i.e. AUTH_URL) — anything else gets
    // silently swapped for baseUrl. This widens the check to also trust
    // biznest.space and any of its subdomains, while still refusing to
    // redirect to some unrelated, attacker-controlled host.
    async redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        const rootHost = new URL(baseUrl).hostname.replace(/^www\./, ""); // "biznest.space"
        if (target.hostname === rootHost || target.hostname.endsWith(`.${rootHost}`)) {
          return target.toString();
        }
      } catch {
        // Malformed url — fall through to the safe default below.
      }
      return baseUrl;
    },
  },
};
