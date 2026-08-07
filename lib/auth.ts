import type { UserRole } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { authConfig } from "@/lib/auth.config";

// If the database call inside authorize() hangs (e.g. DATABASE_URL pointing
// at an unreachable or misconfigured connection), the whole sign-in request
// hangs with it — no error, no timeout, nothing, indefinitely. This wraps
// any promise with a hard deadline so a DB problem shows up as a real error
// within 8 seconds instead of leaving the user staring at "Signing in…"
// forever. This does not fix a bad DATABASE_URL — it just makes a bad one
// loud instead of silent.
function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), ms)),
  ]);
}

// IMPORTANT: this file must never be imported from middleware.ts. It pulls
// in Prisma (via the adapter, Credentials provider, and the jwt callback
// below), and Next.js Middleware always runs on the Edge Runtime, which
// cannot run Prisma Client. middleware.ts has its own lightweight `auth()`
// built from lib/auth.config.ts instead — see that file for the full
// explanation. Importing this file from middleware.ts is exactly the
// regression that broke sign-in sitewide; don't reintroduce it.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        let user;
        try {
          user = await withTimeout(
            prisma.user.findUnique({ where: { email: parsed.data.email } })
          );
        } catch (err) {
          if (err instanceof Error && err.message === "DB_TIMEOUT") {
            // Surfaces as a normal NextAuth error the login form already
            // handles, rather than an unhandled hang. If you see this in
            // practice, it confirms the database — not auth config — is
            // the problem: check DATABASE_URL in Vercel's env vars against
            // Supabase's *pooled* connection string (port 6543,
            // ?pgbouncer=true), not the direct one (port 5432).
            throw new Error("DB_UNAVAILABLE");
          }
          throw err;
        }
        if (!user?.passwordHash) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("ACCOUNT_LOCKED");
        }

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          const MAX_ATTEMPTS = 5;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + 15 * 60 * 1000) : null,
            },
          });
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        if (user.isBanned) {
          throw new Error("ACCOUNT_BANNED");
        }

        // TEMPORARILY DISABLED: email verification is required in principle,
        // but Resend is still in sandbox mode (only delivers to the
        // account's own email), so real users can't yet complete it. Add
        // this check back once a verified sending domain is configured —
        // see EMAIL_FROM in .env.example.
        // if (!user.emailVerified) {
        //   throw new Error("EMAIL_NOT_VERIFIED");
        // }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      } else if (token.id) {
        // Session strategy is JWT, so the token is normally just decoded and
        // reused across requests without touching the DB again. That means
        // a role change (e.g. via /api/promote-admin, or a ban) never took
        // effect until the user logged out and back in. Re-check the DB
        // role here so promotions/bans apply immediately — safe in this
        // file specifically because everything that imports lib/auth.ts
        // (Server Components, Route Handlers, Server Actions) runs on the
        // Node.js runtime, not Edge. One indexed PK lookup — fine at this
        // scale, same tradeoff as RateLimitEntry elsewhere in this codebase.
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, isBanned: true, sessionsInvalidatedAt: true },
        });
        if (!current) return null; // user deleted since token was issued

        // Returning null here signs the user out on their very next request
        // — Next-Auth treats a null jwt() return as "no session." Two cases:
        // they've since been banned, or an admin hit "force logout" (which
        // bumps sessionsInvalidatedAt to now) after this token was issued.
        if (current.isBanned) return null;
        if (current.sessionsInvalidatedAt && typeof token.iat === "number" && token.iat * 1000 < current.sessionsInvalidatedAt.getTime()) {
          return null;
        }

        token.role = current.role;
      }
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
});
