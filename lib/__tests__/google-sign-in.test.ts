import { describe, it, expect, vi, beforeEach } from "vitest";

const baseAdapter = {
  createUser: vi.fn(async (u: Record<string, unknown>) => ({ id: "new", ...u })),
};
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => baseAdapter }));

import { bizNestAdapter, canSignInWithGoogle } from "@/lib/auth-adapter";

function fakePrisma(found: unknown) {
  return {
    user: {
      findFirst: vi.fn(async () => found),
      findUnique: vi.fn(async () => {
        throw new Error("findUnique by email is invalid: email is not globally unique");
      }),
    },
  };
}

describe("Google sign-in adapter", () => {
  beforeEach(() => baseAdapter.createUser.mockClear());

  it("looks the user up by email within the main platform identity only, case-insensitively", async () => {
    const prisma = fakePrisma({ id: "u1", email: "amaka@example.com" });
    const adapter = bizNestAdapter(prisma as never);
    const user = await adapter.getUserByEmail!("  Amaka@Example.com ");

    expect(user).toMatchObject({ id: "u1" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: "Amaka@Example.com", mode: "insensitive" },
        customerScopeStoreId: null,
        isMarketingOnly: false,
      },
    });
  });

  it("returns null (not undefined) when there is no matching platform account", async () => {
    const adapter = bizNestAdapter(fakePrisma(null) as never);
    expect(await adapter.getUserByEmail!("nobody@example.com")).toBeNull();
  });

  it("creates new Google users with a lowercased email", async () => {
    const adapter = bizNestAdapter(fakePrisma(null) as never);
    await adapter.createUser!({ email: "Amaka@Example.COM", name: "Amaka", emailVerified: null } as never);
    expect(baseAdapter.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "amaka@example.com" }));
  });
});

describe("canSignInWithGoogle", () => {
  it("allows a brand-new Google user (no row yet)", () => {
    expect(canSignInWithGoogle({})).toBe(true);
  });

  it("allows a returning owner whose business is still pending (role CUSTOMER, no store scope)", () => {
    expect(canSignInWithGoogle({ customerScopeStoreId: null, isBanned: false })).toBe(true);
  });

  it("blocks store-scoped customer accounts", () => {
    expect(canSignInWithGoogle({ customerScopeStoreId: "store_1" })).toBe(false);
  });

  it("blocks banned accounts", () => {
    expect(canSignInWithGoogle({ customerScopeStoreId: null, isBanned: true })).toBe(false);
  });
});
