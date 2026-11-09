import type { Prisma } from "@prisma/client";

export const AUDIENCES = [
  { value: "NO_BUSINESS", label: "Signed up, no store started", hint: "Verified accounts that haven't applied to open a store" },
  { value: "BUSINESS_NO_STORE", label: "Applied, store not opened", hint: "Have a business application but no store yet" },
  { value: "STORE_OWNERS", label: "Store owners", hint: "People who already have a store" },
  { value: "ALL", label: "Everyone on BizNest", hint: "All verified owner and member accounts" },
] as const;

export type Audience = (typeof AUDIENCES)[number]["value"];

export function isAudience(v: string): v is Audience {
  return AUDIENCES.some((a) => a.value === v);
}

/**
 * Who may receive BizNest's own emails at all: a verified, not-banned,
 * platform-level account (never a store's customer account) that hasn't opted out.
 */
export const BASE_RECIPIENT: Prisma.UserWhereInput = {
  customerScopeStoreId: null,
  isMarketingOnly: false,
  emailVerified: { not: null },
  isBanned: false,
  platformEmailOptOutAt: null,
  role: { in: ["CUSTOMER", "MEMBER", "STORE_OWNER"] },
};

export function audienceWhere(audience: Audience): Prisma.UserWhereInput {
  switch (audience) {
    case "NO_BUSINESS":
      return { ...BASE_RECIPIENT, role: "CUSTOMER", business: { is: null } };
    case "BUSINESS_NO_STORE":
      return { ...BASE_RECIPIENT, business: { is: { store: { is: null } } } };
    case "STORE_OWNERS":
      return { ...BASE_RECIPIENT, business: { is: { store: { isNot: null } } } };
    case "ALL":
      return { ...BASE_RECIPIENT };
  }
}
