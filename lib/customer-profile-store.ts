import { canonicalPhone, phoneVariants } from "@/lib/phone";
import { mergeProfileUpdate, pickProfile, type ProfileLike } from "@/lib/customer-profile-merge";

/**
 * Race-safe find-or-create for StoreCustomerProfile.
 *
 * The database now enforces one profile per (store, email), (store, phone) and
 * (store, user) -- see migration 20261108090000_customer_profile_unique. These
 * helpers rely on that: they try the write, and when a concurrent request (or
 * a stale read) wins the race, the unique violation (P2002) is treated as
 * "someone just created it" and the profile is looked up again rather than
 * surfacing an error or creating a duplicate.
 */

// Structural type so tests can pass a fake and callers pass the real PrismaClient.
export type ProfileDb = {
  storeCustomerProfile: { findMany: (a: any) => Promise<any[]>; findFirst: (a: any) => Promise<any>; create: (a: any) => Promise<any>; update: (a: any) => Promise<any> };
  user: { findFirst: (a: any) => Promise<any> };
};

const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === "P2002";
const SELECT = { id: true, name: true, email: true, phone: true, userId: true, updatedAt: true } as const;

/** POS sale: find the customer by phone/email or create them. Returns the profile id. */
export async function findOrCreatePosProfile(
  db: ProfileDb,
  input: { storeId: string; name: string | null; email: string | null; phone: string | null; phoneRaw: string | null },
): Promise<string> {
  const { storeId, name, email, phone, phoneRaw } = input;
  const incoming = { name, email, phone };

  for (let attempt = 0; attempt < 3; attempt++) {
    const [candidates, matchingUser] = await Promise.all([
      db.storeCustomerProfile.findMany({
        where: { storeId, OR: [...(phone ? [{ phone: { in: phoneVariants(phoneRaw) } }] : []), ...(email ? [{ email }] : [])] },
        select: SELECT,
      }),
      email ? db.user.findFirst({ where: { email, customerScopeStoreId: storeId }, select: { id: true } }) : Promise.resolve(null),
    ]);
    const existing = pickProfile(candidates as ProfileLike[], incoming);

    if (existing) {
      const linkedElsewhere = matchingUser
        ? !!(await db.storeCustomerProfile.findFirst({ where: { storeId, userId: matchingUser.id, id: { not: existing.id } }, select: { id: true } }))
        : false;
      const { data } = mergeProfileUpdate(existing, incoming, matchingUser ? { id: matchingUser.id, linkedToOtherProfile: linkedElsewhere } : null);
      if (Object.keys(data).length === 0) return existing.id;
      try {
        await db.storeCustomerProfile.update({ where: { id: existing.id }, data, select: { id: true } });
      } catch (err) {
        // The value we tried to fill in now belongs to another profile (a
        // concurrent write). The sale still belongs to `existing`; skip the fill.
        if (!isUniqueViolation(err)) throw err;
      }
      return existing.id;
    }

    try {
      const created = await db.storeCustomerProfile.create({
        data: { storeId, userId: matchingUser?.id ?? null, name: name || phone || email || "Customer", phone, email },
        select: { id: true },
      });
      return created.id;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Lost the race: loop, and this time the lookup finds the winner's row.
    }
  }
  throw new Error("Could not save the customer profile. Please try again.");
}

/**
 * A logged-in storefront customer needs exactly one profile in the store.
 * Reuses a profile that already exists for their email (e.g. created earlier by
 * a POS sale) instead of creating a duplicate, linking it to the account.
 */
export async function ensureAccountProfile(
  db: ProfileDb,
  input: { storeId: string; userId: string; name: string; email: string | null; phone?: string | null; preferences?: unknown },
): Promise<{ id: string; created: boolean }> {
  const { storeId, userId } = input;
  const email = input.email?.trim().toLowerCase() || null;
  const phone = canonicalPhone(input.phone);
  const prefs = input.preferences === undefined ? {} : { preferences: input.preferences };

  for (let attempt = 0; attempt < 3; attempt++) {
    const mine = await db.storeCustomerProfile.findFirst({ where: { storeId, userId }, select: { id: true } });
    if (mine) {
      if (input.preferences !== undefined) await db.storeCustomerProfile.update({ where: { id: mine.id }, data: prefs, select: { id: true } });
      return { id: mine.id, created: false };
    }

    const byEmail = email ? await db.storeCustomerProfile.findFirst({ where: { storeId, email }, select: SELECT }) : null;
    if (byEmail && !byEmail.userId) {
      const data: Record<string, unknown> = { userId, ...prefs };
      if (!byEmail.name || byEmail.name === byEmail.email || byEmail.name === byEmail.phone || byEmail.name === "Customer") data.name = input.name;
      try {
        await db.storeCustomerProfile.update({ where: { id: byEmail.id }, data, select: { id: true } });
        return { id: byEmail.id, created: false };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        continue; // the account got a profile concurrently: re-read
      }
    }

    // No reusable profile. If the email belongs to a profile owned by a
    // different account, don't claim it (and don't collide on it).
    const useEmail = byEmail ? null : email;
    for (const withPhone of phone ? [true, false] : [false]) {
      try {
        const created = await db.storeCustomerProfile.create({
          data: { storeId, userId, name: input.name || email || "Customer", email: useEmail, phone: withPhone ? phone : null, ...prefs },
          select: { id: true },
        });
        return { id: created.id, created: true };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Either our phone belongs to another profile (retry without it) or a
        // concurrent request created ours (the outer loop re-reads it).
      }
    }
  }
  throw new Error("Could not save the customer profile. Please try again.");
}