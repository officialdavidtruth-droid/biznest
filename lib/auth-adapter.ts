import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { PrismaClient } from "@prisma/client";

/**
 * Auth.js adapter for BizNest's identity model.
 *
 * Why not plain PrismaAdapter(prisma): its getUserByEmail does
 * `user.findUnique({ where: { email } })`, but User.email stopped being
 * globally unique (it's unique per customer scope: see customerScopeStoreId /
 * isMarketingOnly on User). Prisma rejects that query outright, so every
 * Google sign-in threw before it could finish. Here the email lookup is
 * scoped to the main platform identity -- the only place Google sign-in is
 * offered -- and is case-insensitive like the credentials login.
 */
export function bizNestAdapter(prisma: PrismaClient): Adapter {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    async getUserByEmail(email: string) {
      const user = await prisma.user.findFirst({
        where: {
          email: { equals: email.trim(), mode: "insensitive" },
          customerScopeStoreId: null,
          isMarketingOnly: false,
        },
      });
      return (user as unknown as AdapterUser | null) ?? null;
    },
    async createUser(data) {
      // Stored lowercase, same as registerUser.
      return base.createUser!({ ...data, email: data.email.trim().toLowerCase() });
    },
  };
}

/**
 * Decides whether an existing (or brand-new) user may complete a Google
 * sign-in.
 *  - Store customers (customerScopeStoreId set) never get Google sessions:
 *    their login is store-scoped credentials only.
 *  - Banned accounts are refused here too (the credentials path already does).
 *  - Everyone else is allowed -- including an owner whose business is still
 *    pending review, who has role CUSTOMER by default. The old check blocked
 *    on role === "CUSTOMER", which locked those people out on their second
 *    Google sign-in.
 * A brand-new Google user has no row yet, so neither field is present.
 */
export function canSignInWithGoogle(user: { customerScopeStoreId?: string | null; isBanned?: boolean | null }): boolean {
  if (user.isBanned) return false;
  if (user.customerScopeStoreId) return false;
  return true;
}
