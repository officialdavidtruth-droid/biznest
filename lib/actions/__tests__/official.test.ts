import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  prisma: {
    store: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn(), create: vi.fn() },
    business: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    browsePost: { count: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
  staff: vi.fn(), assertStorePermission: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-guard", () => ({ isPlatformStaff: m.staff }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: m.assertStorePermission }));

import { ensureOfficialAccount, updateOfficialProfile } from "@/lib/actions/official";
import { createBrowsePost } from "@/lib/actions/browse-vendor";

beforeEach(() => {
  vi.clearAllMocks();
  m.staff.mockResolvedValue(true);
  m.prisma.store.findUnique.mockResolvedValue(null);
  m.prisma.user.findFirst.mockResolvedValue(null);
  m.prisma.user.create.mockResolvedValue({ id: "u1" });
  m.prisma.business.findUnique.mockResolvedValue(null);
  m.prisma.business.create.mockResolvedValue({ id: "b1" });
  m.prisma.store.create.mockResolvedValue({ id: "s1" });
  m.prisma.$transaction.mockResolvedValue([]);
});

describe("ensureOfficialAccount", () => {
  it("creates a login-less owner, a verified business and the store", async () => {
    expect(await ensureOfficialAccount()).toEqual({ success: true, data: { slug: "biznest-official" } });
    expect(m.prisma.user.create.mock.calls[0][0].data).not.toHaveProperty("passwordHash");
    expect(m.prisma.business.create.mock.calls[0][0].data).toMatchObject({ verificationBadge: true, verificationStatus: "APPROVED", searchVisible: true });
    expect(m.prisma.store.create.mock.calls[0][0].data).toMatchObject({ slug: "biznest-official", status: "ACTIVE", businessId: "b1" });
  });
  it("is a no-op when it already exists", async () => {
    m.prisma.store.findUnique.mockResolvedValue({ id: "s1" });
    expect((await ensureOfficialAccount()).success).toBe(true);
    expect(m.prisma.user.create).not.toHaveBeenCalled();
  });
  it("needs a SupaAdmin session", async () => {
    m.staff.mockResolvedValue(false);
    expect((await ensureOfficialAccount()).success).toBe(false);
    expect(m.prisma.store.create).not.toHaveBeenCalled();
  });
  it("reports a taken slug instead of crashing", async () => {
    m.prisma.store.create.mockRejectedValue(new Error("unique"));
    expect((await ensureOfficialAccount()).success).toBe(false);
  });
});

describe("updateOfficialProfile", () => {
  beforeEach(() => m.prisma.store.findUnique.mockResolvedValue({ id: "s1", businessId: "b1" }));
  it("saves name, bio and logo", async () => {
    expect((await updateOfficialProfile({ name: "BizNest", bio: "News and tips for Nigerian businesses.", logoUrl: "https://res.cloudinary.com/demo/logo.png" })).success).toBe(true);
    expect(m.prisma.$transaction).toHaveBeenCalled();
  });
  it("rejects short input and non-https logos", async () => {
    expect((await updateOfficialProfile({ name: "B", bio: "News and tips for Nigerian businesses." })).success).toBe(false);
    expect((await updateOfficialProfile({ name: "BizNest", bio: "short" })).success).toBe(false);
    expect((await updateOfficialProfile({ name: "BizNest", bio: "News and tips for Nigerian businesses.", logoUrl: "http://example.com/a.png" })).success).toBe(false);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("needs a SupaAdmin session", async () => {
    m.staff.mockResolvedValue(false);
    expect((await updateOfficialProfile({ name: "BizNest", bio: "News and tips for Nigerian businesses." })).success).toBe(false);
  });
});

describe("posting as the official account", () => {
  it("lets SupaAdmin staff use the vendor post action, without a store permission check", async () => {
    m.prisma.store.findUnique.mockResolvedValue({ id: "s1", status: "ACTIVE" });
    m.prisma.browsePost.count.mockResolvedValue(0);
    m.prisma.browsePost.create.mockResolvedValue({ id: "p1" });
    expect(await createBrowsePost("biznest-official", { caption: "Welcome to BizNest Browse" })).toEqual({ success: true, data: { id: "p1" } });
    expect(m.assertStorePermission).not.toHaveBeenCalled();
    expect(m.prisma.browsePost.create.mock.calls[0][0].data.storeId).toBe("s1");
  });
  it("refuses everyone else", async () => {
    m.staff.mockResolvedValue(false);
    expect((await createBrowsePost("biznest-official", { caption: "Hello" })).success).toBe(false);
    expect(m.prisma.browsePost.create).not.toHaveBeenCalled();
    expect(m.assertStorePermission).not.toHaveBeenCalled();
  });
});
