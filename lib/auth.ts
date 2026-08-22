import type { UserRole } from "@prisma/client";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { authConfig } from "@/lib/auth.config";
import { logError, logWarn } from "@/lib/observability/log";

// Auth.js v5 quirk that cost real debugging time: a plain `throw new
// Error("ACCOUNT_LOCKED")` inside authorize() does NOT reach the client as
// that message. It collapses into the generic "CredentialsSignin" error
// type, indistinguishable from a genuinely wrong password — the messages
// map in login-form.tsx would never match it and every failure mode
// (locked, banned, DB down, actually-wrong-password) all showed the same
// "Invalid email or password" text. The documented fix is to throw a
// subclass of CredentialsSignin with a `code`, which Auth.js preserves
// through to result.error on the client instead of collapsing it.
// See https://authjs.dev/getting-started/providers/credentials#error-handling
class DbUnavailableError extends CredentialsSignin {
  code = "DB_UNAVAILABLE";
}
class AccountLockedError extends CredentialsSignin {
  code = "ACCOUNT_LOCKED";
}
class AccountBannedError extends CredentialsSignin {
  code = "ACCOUNT_BANNED";
}
// Thrown when a customer who has an account, but never signed up for
// *this* store, tries to log in on this store's branded login page.
// Staff logins (staffLogin branch below) and any account with no store
// context at all are unaffected -- this only gates CUSTOMER logins that
// are happening with a store slug attached.
class StoreAccountNotFoundError extends CredentialsSignin {
  code = "STORE_ACCOUNT_NOT_FOUND";
}

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
        storeSlug: { label: "Store", type: "text" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Case-insensitive on purpose: registerUser didn't normalize casing
        // (email is stored exactly as typed at signup), so an existing
        // account like "Name@Gmail.com" would never match a login attempt
        // of "name@gmail.com" with a plain findUnique — the password check
        // never even runs, and the person just sees "Invalid email or
        // password" no matter how correct their password is. New signups
        // are normalized going forward (see registerUser in
        // lib/actions/auth.ts), but this covers accounts created before
        // that and needs to stay even after every account is normalized,
        // since email is meant to be case-insensitive by convention anyway.
        // Staff can sign in two ways: with their own email (handled below,
        // same as everyone else), or with "<username>@<store-slug>" — the
        // login handle the owner set when inviting them (e.g.
        // "amaka@velox-space"). Both resolve to the same underlying User
        // account and passwordHash; this just finds that account a
        // different way when the identifier isn't a real email.
        // staffLogin stays null for a normal email sign-in.
        let staffLogin: { storeSlug: string; storeName: string; position: string } | null = null;
        let user;
        try {
          user = await withTimeout(
            prisma.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" } } })
          );

          if (!user) {
            const atIndex = parsed.data.email.lastIndexOf("@");
            if (atIndex > 0) {
              const handle = parsed.data.email.slice(0, atIndex);
              const storeSlug = parsed.data.email.slice(atIndex + 1).toLowerCase();

              const staff = await withTimeout(
                prisma.storeStaff.findFirst({
                  where: {
                    status: "ACTIVE",
                    OR: [
                      { username: { equals: handle, mode: "insensitive" } },
                      // Older invites (created before admin-set usernames)
                      // only have a position -- keep matching those too so
                      // existing staff logins don't break.
                      { username: null, position: { equals: handle, mode: "insensitive" } },
                    ],
                    store: { slug: storeSlug },
                  },
                  include: { user: true, store: { select: { slug: true, name: true } } },
                })
              );

              if (staff?.user) {
                user = staff.user;
                staffLogin = { storeSlug: staff.store.slug, storeName: staff.store.name, position: staff.position ?? "Staff" };
              }
            }
          }
        } catch (err) {
          if (err instanceof Error && err.message === "DB_TIMEOUT") {
            // Surfaces as a normal NextAuth error the login form already
            // handles, rather than an unhandled hang. If you see this in
            // practice, it confirms the database — not auth config — is
            // the problem: check DATABASE_URL in Vercel's env vars against
            // Supabase's *pooled* connection string (port 6543,
            // ?pgbouncer=true), not the direct one (port 5432).
            void logError("DATABASE", "Login lookup timed out", { email: parsed.data.email });
            throw new DbUnavailableError();
          }
          throw err;
        }
        if (!user?.passwordHash) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          void logWarn("AUTH", "Login attempt on locked account", { userId: user.id });
          throw new AccountLockedError();
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
          void logWarn("AUTH", "Failed login attempt", { userId: user.id, attempts, locked: attempts >= MAX_ATTEMPTS });
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        if (user.isBanned) {
          void logWarn("AUTH", "Login attempt on banned account", { userId: user.id });
          throw new AccountBannedError();
        }

        // Customer accounts only exist to sign in to the one store they
        // signed up through (see StoreCustomer / the migration comment on
        // it) — they have no business logging in on the generic BizNest
        // platform login (biznest.space/login, no ?store=), which is for
        // store owners/admins. Staff already went through their own
        // store-scoped branch above and are unaffected.
        const storeSlug = typeof credentials?.storeSlug === "string" ? credentials.storeSlug : undefined;
        if (!staffLogin && user.role === "CUSTOMER") {
          if (!storeSlug) {
            void logWarn("AUTH", "Customer login attempt with no store context", { userId: user.id });
            throw new StoreAccountNotFoundError();
          }
          const membership = await prisma.storeCustomer.findFirst({
            where: { userId: user.id, store: { slug: storeSlug } },
          });
          if (!membership) {
            void logWarn("AUTH", "Customer login attempt outside their store", { userId: user.id, storeSlug });
            throw new StoreAccountNotFoundError();
          }
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
          ...(staffLogin
            ? { staffPosition: staffLogin.position, storeSlug: staffLogin.storeSlug, storeName: staffLogin.storeName }
            : {}),
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
        // Only set on a fresh sign-in via the "Position@store" path (see
        // authorize() above). Deliberately not re-derived on later
        // requests below — a staff member's position/store doesn't change
        // mid-session, and this keeps that branch a plain DB role re-check
        // instead of an extra join on every request.
        const staffUser = user as typeof user & { staffPosition?: string; storeSlug?: string; storeName?: string };
        if (staffUser.staffPosition) {
          token.staffPosition = staffUser.staffPosition;
          token.storeSlug = staffUser.storeSlug;
          token.storeName = staffUser.storeName;
        }
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
        if (token.staffPosition) {
          session.user.staffPosition = token.staffPosition as string;
          session.user.storeSlug = token.storeSlug as string;
          session.user.storeName = token.storeName as string;
        }
      }
      return session;
    },
  },
});
