import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    browseLike: { deleteMany: vi.fn(), create: vi.fn() },
    browsePost: { update: vi.fn(), findUnique: vi.fn() },
    browseStoryView: { create: vi.fn() },
    browseStory: { update: vi.fn() },
    browseFollow: { deleteMany: vi.fn(), create: vi.fn() },
    store: { update: vi.fn(), findUnique: vi.fn() },
  };
  return {
    tx,
    prisma: {
      browsePost: { findFirst: vi.fn(), update: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
      browseComment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      browseReport: { create: vi.fn(), count: vi.fn() },
      browseStory: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
      product: { findFirst: vi.fn() },
      store: { findFirst: vi.fn() },
      notification: { findFirst: vi.fn() },
      $transaction: vi.fn(async (arg: unknown) => (typeof arg === "function" ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as unknown[]))),
    },
    getViewer: vi.fn(),
    checkRateLimit: vi.fn(),
    notifyUser: vi.fn(),
    assertStorePermission: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error { code: string; constructor(msg: string, o: { code: string }) { super(msg); this.code = o.code; } }
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }), cookies: async () => ({ get: () => undefined, set: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit, getClientIp: () => "203.0.113.5" }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: m.notifyUser }));
vi.mock("@/lib/browse-viewer", () => ({ getViewer: m.getViewer }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: m.assertStorePermission }));

import { Prisma } from "@prisma/client";
import { FOLLOW_NEEDS_ACCOUNT, INTERACT_NEEDS_ACCOUNT } from "@/lib/browse";
import { addBrowseComment, markStoryViewed, reportBrowse, toggleBrowseLike, toggleFollowStore } from "@/lib/actions/browse";
import { createBrowseStory, setBrowsePostHidden, shareProductToBrowse } from "@/lib/actions/browse-vendor";

const guest = { key: "d:abcdefghijklmnop", userId: null, name: null };
const member = { key: "u:member1xxxxxxxx", userId: "member1", name: "Amaka" };
const post = { id: "p1", caption: "hi", store: { id: "s1", slug: "acme-test", name: "Acme Test", business: { user: { id: "owner1" } } } };

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.$transaction.mockImplementation(async (arg: unknown) => (typeof arg === "function" ? (arg as (t: typeof m.tx) => unknown)(m.tx) : Promise.all(arg as unknown[])));
  m.getViewer.mockResolvedValue(member);
  m.checkRateLimit.mockResolvedValue({ allowed: true });
  m.notifyUser.mockResolvedValue(undefined);
  m.prisma.browsePost.findFirst.mockResolvedValue(post);
  m.prisma.notification.findFirst.mockResolvedValue(null);
});

describe("guests", () => {
  it("can't like or comment; nothing is written", async () => {
    m.getViewer.mockResolvedValue(guest);
    expect(await toggleBrowseLike("p1")).toEqual({ success: false, error: INTERACT_NEEDS_ACCOUNT });
    expect(await addBrowseComment("p1", { body: "nice" })).toEqual({ success: false, error: INTERACT_NEEDS_ACCOUNT });
    m.getViewer.mockResolvedValue(null);
    expect((await toggleBrowseLike("p1")).success).toBe(false);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.prisma.browseComment.create).not.toHaveBeenCalled();
  });
});

describe("like and follow alerts for the business owner", () => {
  beforeEach(() => {
    m.tx.browseLike.deleteMany.mockResolvedValue({ count: 0 });
    m.tx.browseLike.create.mockResolvedValue({});
    m.tx.browsePost.update.mockResolvedValue({ likeCount: 1 });
  });
  it("tells the owner when someone likes a post", async () => {
    await toggleBrowseLike("p1");
    expect(m.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner1", type: "BROWSE_LIKE", title: "Amaka liked your Browse post", url: "/store/acme-test/admin/browse/activity" }));
  });
  it("stays quiet for an unlike, the owner's own like, and an alert still waiting unread", async () => {
    m.tx.browseLike.deleteMany.mockResolvedValue({ count: 1 });
    m.tx.browsePost.update.mockResolvedValue({ likeCount: 0 });
    await toggleBrowseLike("p1");
    m.tx.browseLike.deleteMany.mockResolvedValue({ count: 0 });
    m.getViewer.mockResolvedValue({ key: "u:owner1xxxxxxxx", userId: "owner1", name: "Owner" });
    await toggleBrowseLike("p1");
    m.getViewer.mockResolvedValue(member);
    m.prisma.notification.findFirst.mockResolvedValue({ id: "n1" });
    await toggleBrowseLike("p1");
    expect(m.notifyUser).not.toHaveBeenCalled();
  });
  it("still completes the like when the alert can't be written", async () => {
    m.notifyUser.mockRejectedValue(new Error("push down"));
    expect((await toggleBrowseLike("p1")).success).toBe(true);
  });
});

describe("toggleBrowseLike", () => {
  it("likes and counts", async () => {
    m.tx.browseLike.deleteMany.mockResolvedValue({ count: 0 });
    m.tx.browseLike.create.mockResolvedValue({});
    m.tx.browsePost.update.mockResolvedValue({ likeCount: 5 });
    expect(await toggleBrowseLike("p1")).toEqual({ success: true, data: { liked: true, likeCount: 5 } });
    expect(m.tx.browsePost.update.mock.calls[0][0].data).toEqual({ likeCount: { increment: 1 } });
  });
  it("unlikes on the second tap and never goes below zero", async () => {
    m.tx.browseLike.deleteMany.mockResolvedValue({ count: 1 });
    m.tx.browsePost.update.mockResolvedValue({ likeCount: -1 });
    expect(await toggleBrowseLike("p1")).toEqual({ success: true, data: { liked: false, likeCount: 0 } });
  });
  it("treats a parallel double-tap as already liked", async () => {
    m.tx.browseLike.deleteMany.mockResolvedValue({ count: 0 });
    m.tx.browseLike.create.mockRejectedValue(new (Prisma.PrismaClientKnownRequestError as unknown as new (msg: string, o: { code: string }) => Error)("dup", { code: "P2002" }));
    m.tx.browsePost.findUnique.mockResolvedValue({ likeCount: 3 });
    expect(await toggleBrowseLike("p1")).toEqual({ success: true, data: { liked: true, likeCount: 3 } });
    expect(m.tx.browsePost.update).not.toHaveBeenCalled();
  });
  it("refuses unavailable posts, missing identity and floods", async () => {
    m.prisma.browsePost.findFirst.mockResolvedValue(null);
    expect((await toggleBrowseLike("p1")).success).toBe(false);
    m.getViewer.mockResolvedValue(null);
    expect((await toggleBrowseLike("p1")).success).toBe(false);
    m.getViewer.mockResolvedValue(member);
    m.checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await toggleBrowseLike("p1")).success).toBe(false);
  });
});

describe("addBrowseComment", () => {
  beforeEach(() => {
    m.prisma.browseComment.findFirst.mockResolvedValue(null);
    m.prisma.browseComment.create.mockResolvedValue({ id: "c1", authorName: "Ada", body: "Lovely", createdAt: new Date("2026-12-01T10:00:00Z") });
    m.prisma.browsePost.update.mockResolvedValue({ commentCount: 2 });
  });
  it("posts a comment and tells the store owner", async () => {
    const r = await addBrowseComment("p1", { body: "Lovely" });
    expect(r).toMatchObject({ success: true, data: { commentCount: 2, comment: { id: "c1", mine: true } } });
    expect(m.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner1", type: "BROWSE_COMMENT", url: "/store/acme-test/admin/browse/activity" }));
  });
  it("does not notify owners about their own comments", async () => {
    m.getViewer.mockResolvedValue({ key: "u:owner1xxxxxxxx", userId: "owner1", name: "Owner" });
    await addBrowseComment("p1", { body: "Thanks all!" });
    expect(m.notifyUser).not.toHaveBeenCalled();
  });
  it("rejects links, duplicates and rate-limited senders before writing", async () => {
    expect((await addBrowseComment("p1", { body: "visit www.spam.ng" })).success).toBe(false);
    m.prisma.browseComment.findFirst.mockResolvedValue({ id: "old" });
    expect(await addBrowseComment("p1", { body: "Lovely" })).toEqual({ success: false, error: "You already posted that." });
    m.checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await addBrowseComment("p1", { body: "Another" })).success).toBe(false);
    expect(m.prisma.browseComment.create).not.toHaveBeenCalled();
  });
});

describe("reportBrowse", () => {
  beforeEach(() => {
    m.prisma.browsePost.findFirst.mockResolvedValue({ id: "p1", status: "PUBLISHED" });
    m.prisma.browseReport.create.mockResolvedValue({});
  });
  it("only records the report below the threshold", async () => {
    m.prisma.browseReport.count.mockResolvedValue(2);
    expect(await reportBrowse({ postId: "p1", reason: "SPAM" })).toEqual({ success: true, data: undefined });
    expect(m.prisma.browsePost.update).not.toHaveBeenCalled();
  });
  it("hides a post for review once three people reported it", async () => {
    m.prisma.browseReport.count.mockResolvedValue(3);
    await reportBrowse({ postId: "p1", reason: "SCAM" });
    expect(m.prisma.browsePost.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { status: "HIDDEN", hiddenReason: "REPORTS" } });
  });
  it("hides a reported comment and lowers the count", async () => {
    m.prisma.browseComment.findFirst.mockResolvedValue({ id: "c1", status: "VISIBLE" });
    m.prisma.browseReport.count.mockResolvedValue(3);
    await reportBrowse({ postId: "p1", commentId: "c1", reason: "OFFENSIVE" });
    expect(m.prisma.browseComment.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { status: "HIDDEN" } });
    expect(m.prisma.browsePost.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { commentCount: { decrement: 1 } } });
  });
  it("ignores a repeat report from the same person and rejects unknown reasons", async () => {
    m.prisma.browseReport.create.mockRejectedValue(new (Prisma.PrismaClientKnownRequestError as unknown as new (msg: string, o: { code: string }) => Error)("dup", { code: "P2002" }));
    expect((await reportBrowse({ postId: "p1", reason: "SPAM" })).success).toBe(true);
    expect(m.prisma.browseReport.count).not.toHaveBeenCalled();
    expect((await reportBrowse({ postId: "p1", reason: "BORING" })).success).toBe(false);
  });
});

describe("vendor actions", () => {
  beforeEach(() => {
    m.assertStorePermission.mockResolvedValue({ success: true, store: { id: "s1", status: "ACTIVE" } });
    m.prisma.browsePost.count.mockResolvedValue(0);
    m.prisma.browsePost.create.mockResolvedValue({ id: "np1" });
    m.prisma.product.findFirst.mockResolvedValue({ id: "pr1", name: "Red Ankara Dress", price: 15000, currency: "NGN", images: ["https://img.example.com/a.jpg", "https://img.example.com/b.jpg"], isPublished: true, archivedAt: null });
  });
  it("shares a product with its photos, name and price", async () => {
    m.prisma.browsePost.findFirst.mockResolvedValue(null);
    expect(await shareProductToBrowse("acme-test", "pr1")).toEqual({ success: true, data: { id: "np1" } });
    expect(m.prisma.browsePost.create.mock.calls[0][0].data).toMatchObject({
      storeId: "s1", kind: "PRODUCT", caption: "New in the shop: Red Ankara Dress", productId: "pr1", productName: "Red Ankara Dress", productPrice: 15000,
      images: ["https://img.example.com/a.jpg", "https://img.example.com/b.jpg"],
    });
  });
  it("won't share a product without photos, twice in a day, or past the daily limit", async () => {
    m.prisma.product.findFirst.mockResolvedValueOnce({ id: "pr1", name: "X", price: 1, currency: "NGN", images: [], isPublished: true, archivedAt: null });
    expect((await shareProductToBrowse("acme-test", "pr1")).success).toBe(false);
    m.prisma.browsePost.findFirst.mockResolvedValue({ id: "recent" });
    expect(await shareProductToBrowse("acme-test", "pr1")).toEqual({ success: false, error: "You already shared this product in the last 24 hours." });
    m.prisma.browsePost.findFirst.mockResolvedValue(null);
    m.prisma.browsePost.count.mockResolvedValue(10);
    expect((await shareProductToBrowse("acme-test", "pr1")).success).toBe(false);
    expect(m.prisma.browsePost.create).not.toHaveBeenCalled();
  });
  it("won't let the owner re-publish a post held for review", async () => {
    m.prisma.browsePost.findFirst.mockResolvedValue({ id: "p1", status: "HIDDEN", hiddenReason: "REPORTS" });
    expect((await setBrowsePostHidden("acme-test", "p1", false)).success).toBe(false);
    m.prisma.browsePost.findFirst.mockResolvedValue({ id: "p1", status: "HIDDEN", hiddenReason: "OWNER" });
    expect((await setBrowsePostHidden("acme-test", "p1", false)).success).toBe(true);
    expect(m.prisma.browsePost.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { status: "PUBLISHED", hiddenReason: null } });
  });
  it("blocks everything for suspended stores", async () => {
    m.assertStorePermission.mockResolvedValue({ success: true, store: { id: "s1", status: "SUSPENDED" } });
    expect((await shareProductToBrowse("acme-test", "pr1")).success).toBe(false);
  });
});

const dupError = () => new (Prisma.PrismaClientKnownRequestError as unknown as new (msg: string, o: { code: string }) => Error)("dup", { code: "P2002" });

describe("stories", () => {
  beforeEach(() => {
    m.assertStorePermission.mockResolvedValue({ success: true, store: { id: "s1", status: "ACTIVE" } });
    m.prisma.browseStory.count.mockResolvedValue(0);
    m.prisma.browseStory.create.mockResolvedValue({ id: "st1" });
    m.prisma.browseStory.deleteMany.mockResolvedValue({ count: 0 });
  });
  it("creates a story that expires in 24 hours", async () => {
    const before = Date.now();
    expect(await createBrowseStory("acme-test", { imageUrl: "https://img.example.com/a.jpg", text: "Fresh batch" })).toEqual({ success: true, data: { id: "st1" } });
    const data = m.prisma.browseStory.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ storeId: "s1", kind: "IMAGE", imageUrl: "https://img.example.com/a.jpg", text: "Fresh batch" });
    expect(data.expiresAt.getTime() - before).toBeGreaterThanOrEqual(24 * 3_600_000 - 1000);
  });
  it("refuses empty stories and the 16th story in a day", async () => {
    expect((await createBrowseStory("acme-test", {})).success).toBe(false);
    m.prisma.browseStory.count.mockResolvedValue(15);
    expect((await createBrowseStory("acme-test", { text: "Hi" })).success).toBe(false);
    expect(m.prisma.browseStory.create).not.toHaveBeenCalled();
  });
  it("counts a view once and not for the owner", async () => {
    m.prisma.browseStory.findFirst.mockResolvedValue({ id: "st1", store: { business: { user: { id: "owner1" } } } });
    await markStoryViewed("st1");
    expect(m.tx.browseStoryView.create).toHaveBeenCalledWith({ data: { storyId: "st1", viewerKey: member.key } });
    expect(m.tx.browseStory.update).toHaveBeenCalledWith({ where: { id: "st1" }, data: { viewCount: { increment: 1 } } });

    m.tx.browseStory.update.mockClear();
    m.getViewer.mockResolvedValue({ key: "u:owner1xxxxxxxx", userId: "owner1", name: "Owner" });
    await markStoryViewed("st1");
    expect(m.tx.browseStory.update).not.toHaveBeenCalled();

    m.getViewer.mockResolvedValue(member);
    m.tx.browseStoryView.create.mockRejectedValue(dupError());
    expect((await markStoryViewed("st1")).success).toBe(true);
  });
  it("hides a story after three reports", async () => {
    m.prisma.browseStory.findFirst.mockResolvedValue({ id: "st1" });
    m.prisma.browseReport.create.mockResolvedValue({});
    m.prisma.browseReport.count.mockResolvedValue(2);
    await reportBrowse({ storyId: "st1", reason: "SPAM" });
    expect(m.prisma.browseStory.updateMany).not.toHaveBeenCalled();
    m.prisma.browseReport.count.mockResolvedValue(3);
    await reportBrowse({ storyId: "st1", reason: "SPAM" });
    expect(m.prisma.browseStory.updateMany).toHaveBeenCalledWith({ where: { id: "st1", status: "ACTIVE" }, data: { status: "HIDDEN" } });
  });
});

describe("toggleFollowStore", () => {
  beforeEach(() => {
    m.getViewer.mockResolvedValue(member);
    m.prisma.store.findFirst.mockResolvedValue({ id: "s1", business: { user: { id: "owner1" } } });
    m.tx.browseFollow.deleteMany.mockResolvedValue({ count: 0 });
    m.tx.browseFollow.create.mockResolvedValue({});
    m.tx.store.update.mockResolvedValue({ followerCount: 7 });
  });
  it("follows and counts", async () => {
    expect(await toggleFollowStore("acme-test")).toEqual({ success: true, data: { following: true, followerCount: 7 } });
    expect(m.tx.browseFollow.create).toHaveBeenCalledWith({ data: { storeId: "s1", viewerKey: member.key } });
    expect(m.tx.store.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { followerCount: { increment: 1 } }, select: { followerCount: true } });
  });
  it("unfollows when already following", async () => {
    m.tx.browseFollow.deleteMany.mockResolvedValue({ count: 1 });
    m.tx.store.update.mockResolvedValue({ followerCount: 6 });
    expect(await toggleFollowStore("acme-test")).toEqual({ success: true, data: { following: false, followerCount: 6 } });
    expect(m.tx.browseFollow.create).not.toHaveBeenCalled();
  });
  it("treats a parallel duplicate tap as already following", async () => {
    m.tx.browseFollow.create.mockRejectedValue(dupError());
    m.tx.store.findUnique.mockResolvedValue({ followerCount: 9 });
    expect(await toggleFollowStore("acme-test")).toEqual({ success: true, data: { following: true, followerCount: 9 } });
  });
  it("won't let owners follow themselves, or follow hidden or missing businesses", async () => {
    m.getViewer.mockResolvedValue({ key: "u:owner1xxxxxxxx", userId: "owner1", name: "Owner" });
    expect((await toggleFollowStore("acme-test")).success).toBe(false);
    m.getViewer.mockResolvedValue(member);
    m.prisma.store.findFirst.mockResolvedValue(null);
    expect((await toggleFollowStore("nope")).success).toBe(false);
    expect(m.tx.browseFollow.create).not.toHaveBeenCalled();
  });
  it("needs an account: guests are turned away before any database work", async () => {
    m.getViewer.mockResolvedValue(guest);
    expect(await toggleFollowStore("acme-test")).toEqual({ success: false, error: FOLLOW_NEEDS_ACCOUNT });
    m.getViewer.mockResolvedValue(null);
    expect((await toggleFollowStore("acme-test")).success).toBe(false);
    expect(m.prisma.store.findFirst).not.toHaveBeenCalled();
    expect(m.tx.browseFollow.create).not.toHaveBeenCalled();
  });
  it("is rate limited", async () => {
    m.checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await toggleFollowStore("acme-test")).success).toBe(false);
  });
});
