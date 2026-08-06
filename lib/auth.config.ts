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
  // /supaadmin now lives on supaadmin.biznest.space (see middleware.ts)
  // instead of a path under the main site. A NextAuth cookie is host-only
  // by default, so a session created while signed in on www.biznest.space
  // would NOT be sent to that subdomain — the admin would look logged out
  // there even though they aren't. Scoping the cookie to ".biznest.space"
  // makes it valid across both hosts. Only done in production: a fixed
  // domain here would silently break auth on localhost and on *.vercel.app
  // preview deployments, which aren't subdomains of biznest.space.
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
  },
};
