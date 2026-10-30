import { canonicalPhone, phoneKey } from "@/lib/phone";

export type ProfileLike = { id: string; name: string; email: string | null; phone: string | null; userId: string | null; updatedAt?: Date };
export type IncomingCustomer = { name: string | null; email: string | null; phone: string | null };

const same = (a: string | null | undefined, b: string | null | undefined) => (a?.trim().toLowerCase() || null) === (b?.trim().toLowerCase() || null);

/**
 * When a POS sale supplies a phone and/or email, several profiles can match
 * (the phone belongs to one person, the email to another). Pick exactly one:
 * a profile matching both wins, then the phone match (a number is what a
 * cashier usually types), then the email match. Ties go to the most recently
 * updated profile. The caller must not then overwrite the *other* identifier.
 */
export function pickProfile<T extends ProfileLike>(candidates: T[], incoming: IncomingCustomer): T | null {
  const pk = phoneKey(incoming.phone);
  const matchesPhone = (p: T) => !!pk && phoneKey(p.phone) === pk;
  const matchesEmail = (p: T) => !!incoming.email && same(p.email, incoming.email);
  const newest = (list: T[]) => [...list].sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))[0] ?? null;
  return (
    newest(candidates.filter((p) => matchesPhone(p) && matchesEmail(p))) ??
    newest(candidates.filter(matchesPhone)) ??
    newest(candidates.filter(matchesEmail)) ??
    null
  );
}

/** A name that is just a stand-in (the phone/email we created the profile with). */
function isPlaceholderName(name: string, p: ProfileLike) {
  const n = name.trim();
  return !n || n === "Customer" || same(n, p.phone) || same(n, p.email);
}

/**
 * What a POS sale may change on an EXISTING profile. Only blanks are filled in;
 * a value that is already set is never replaced, so a mistyped name or another
 * person's email at the till can't rewrite a real customer. The one exception
 * is a placeholder name, which a real name replaces.
 *
 * The login account is linked only when the account's email is the profile's
 * email, and never when that account already belongs to another profile.
 */
export function mergeProfileUpdate(
  existing: ProfileLike,
  incoming: IncomingCustomer,
  matchingUser: { id: string; linkedToOtherProfile: boolean } | null,
) {
  const data: { name?: string; email?: string; phone?: string; userId?: string } = {};
  const kept: string[] = [];

  if (incoming.name) {
    if (isPlaceholderName(existing.name, existing)) data.name = incoming.name;
    else if (!same(existing.name, incoming.name)) kept.push("name");
  }
  if (incoming.email) {
    if (!existing.email) data.email = incoming.email;
    else if (!same(existing.email, incoming.email)) kept.push("email");
  }
  if (incoming.phone) {
    if (!existing.phone) data.phone = incoming.phone;
    else if (phoneKey(existing.phone) !== phoneKey(incoming.phone)) kept.push("phone");
  }

  const finalEmail = data.email ?? existing.email;
  if (matchingUser && !existing.userId && !matchingUser.linkedToOtherProfile && same(finalEmail, incoming.email)) {
    data.userId = matchingUser.id;
  }
  return { data, kept };
}

// ---------------------------------------------------------------------------
// Merging existing duplicates (used by prisma/merge-duplicate-customer-profiles.ts)
// ---------------------------------------------------------------------------
export type MergeableProfile = ProfileLike & { storeId: string; notes: string | null; createdAt: Date };
export type MergePlan = { storeId: string; keepId: string; mergeIds: string[]; patch: { name?: string; email?: string; phone?: string; userId?: string; notes?: string } };
export type MergeReview = { storeId: string; ids: string[]; reason: string };

/**
 * Groups profiles that are the same person: same email, same phone (in any
 * written form) or same login account, within one store. A group is merged
 * automatically only when it is unambiguous -- at most one distinct email and
 * one distinct account. Anything else (e.g. a family sharing a phone number,
 * each with their own email) is returned for a human to decide.
 */
export function planProfileMerges(profiles: MergeableProfile[]): { plans: MergePlan[]; review: MergeReview[] } {
  const parent = profiles.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map<string, number>();
  profiles.forEach((p, i) => {
    const keys = [
      p.email?.trim() ? `${p.storeId}|e|${p.email.trim().toLowerCase()}` : null,
      phoneKey(p.phone) ? `${p.storeId}|p|${phoneKey(p.phone)}` : null,
      p.userId ? `${p.storeId}|u|${p.userId}` : null,
    ];
    for (const k of keys) {
      if (!k) continue;
      const j = seen.get(k);
      if (j === undefined) seen.set(k, i);
      else parent[find(i)] = find(j);
    }
  });

  const groups = new Map<number, MergeableProfile[]>();
  profiles.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p]));

  const plans: MergePlan[] = [];
  const review: MergeReview[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const emails = new Set(group.map((p) => p.email?.trim().toLowerCase()).filter(Boolean));
    const users = new Set(group.map((p) => p.userId).filter(Boolean));
    if (emails.size > 1 || users.size > 1) {
      review.push({ storeId: group[0].storeId, ids: group.map((p) => p.id), reason: emails.size > 1 ? "different emails share a phone number" : "different login accounts" });
      continue;
    }
    // Keep the profile with an account, else the oldest.
    const sorted = [...group].sort((a, b) => Number(!!b.userId) - Number(!!a.userId) || a.createdAt.getTime() - b.createdAt.getTime());
    const [keep, ...rest] = sorted;
    const patch: MergePlan["patch"] = {};
    const first = <K extends "email" | "phone" | "userId">(k: K) => keep[k] || rest.map((r) => r[k]).find(Boolean) || undefined;
    if (isPlaceholderName(keep.name, keep)) {
      const real = rest.find((r) => !isPlaceholderName(r.name, r));
      if (real) patch.name = real.name;
    }
    const email = first("email"); if (email && email !== keep.email) patch.email = email.trim().toLowerCase();
    const phone = first("phone"); const canon = canonicalPhone(phone ?? null);
    if (canon && canon !== keep.phone) patch.phone = canon;
    const userId = first("userId"); if (userId && userId !== keep.userId) patch.userId = userId;
    const notes = [...new Set([keep.notes, ...rest.map((r) => r.notes)].map((n) => n?.trim()).filter(Boolean))].join("\n");
    if (notes && notes !== keep.notes) patch.notes = notes;
    plans.push({ storeId: keep.storeId, keepId: keep.id, mergeIds: rest.map((r) => r.id), patch });
  }
  return { plans, review };
}
