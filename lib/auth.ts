import type { UserRole } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // Required for custom domains behind Vercel (biznest.space, not a
  // *.vercel.app subdomain). Without this, Auth.js can reject the request's
  // host header and the client hangs waiting on a response that never
  // resolves cleanly — this is very likely what's causing the stuck
  // "Signing in…" state. See https://authjs.dev/reference/faq#trusthost.
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      } else if (token.id) {
        // Session strategy is JWT, so the token is normally just decoded and
        // reused across requests without touching the DB again. That means
        // a role change (e.g. via /api/promote-admin, or a ban) never took
        // effect until the user logged out and back in — which is exactly
        // why a freshly-promoted PLATFORM_ADMIN kept getting bounced out of
        // /supaadmin. Re-check the DB role on every request so promotions
        // (and bans) apply immediately. This is one indexed PK lookup — fine
        // at this scale, same tradeoff as RateLimitEntry elsewhere in this
        // codebase; revisit if/when this needs to scale further.
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, isBanned: true },
        });
        if (current) {
          token.role = current.role;
          token.banned = current.isBanned;
        }
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
