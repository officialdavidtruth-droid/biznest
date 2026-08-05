import type { UserRole } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
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

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
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
