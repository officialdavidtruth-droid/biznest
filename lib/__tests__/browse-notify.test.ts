import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  prisma: {
    browseFollow: { findMany: vi.fn() },
    notification: { findMany: vi.fn(), createMany: vi.fn() },
    pushSubscription: { findMany: vi.fn() },
  },
  push: vi.fn(),
  after: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/push/send", () => ({ sendPushToUser: m.push }));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn() }));
vi.mock("next/server", () => ({ after: m.after }));

import { notifyFollowersOfPost, notifyFollowersOfStory } from "@/lib/browse-notify";

const store = { storeId: "s1", storeName: "Amala Hub", storeSlug: "amala-hub" };

/** after() runs the job immediately here so the test can await it. */
async function run(fn: () => void) {
  let job: Promise<void> = Promise.resolve();
  m.after.mockImplementation((j: () => Promise<void>) => { job = j(); });
  fn();
  await job;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.browseFollow.findMany.mockResolvedValue([{ viewerKey: "u:ada1" }, { viewerKey: "u:bayo2" }, { viewerKey: "u:chi3" }]);
  m.prisma.notification.findMany.mockResolvedValue([]);
  m.prisma.notification.createMany.mockResolvedValue({ count: 3 });
  m.prisma.pushSubscription.findMany.mockResolvedValue([{ userId: "ada1" }]);
  m.push.mockResolvedValue(undefined);
});

describe("notifyFollowersOfPost", () => {
  it("alerts signed-in followers only, with a link to the post", async () => {
    await run(() => notifyFollowersOfPost({ ...store, postId: "post123456", caption: "Fresh batch today" }));
    expect(m.prisma.browseFollow.findMany.mock.calls[0][0].where).toEqual({ storeId: "s1", viewerKey: { startsWith: "u:" } });
    const data = m.prisma.notification.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(3);
    expect(data[0]).toEqual({ userId: "ada1", type: "BROWSE_POST", title: "Amala Hub", body: "Fresh batch today", url: "/browse/p/post123456" });
  });
  it("uses the product name when a product is tagged", async () => {
    await run(() => notifyFollowersOfPost({ ...store, postId: "post123456", caption: "x", productName: "Ofada rice" }));
    expect(m.prisma.notification.createMany.mock.calls[0][0].data[0].body).toBe("New: Ofada rice");
  });
  it("skips followers alerted by this business in the last 12 hours", async () => {
    m.prisma.notification.findMany.mockResolvedValue([{ userId: "ada1" }, { userId: "bayo2" }]);
    await run(() => notifyFollowersOfPost({ ...store, postId: "post123456", caption: "Again" }));
    expect(m.prisma.notification.createMany.mock.calls[0][0].data.map((d: { userId: string }) => d.userId)).toEqual(["chi3"]);
  });
  it("pushes only to people with a subscribed device", async () => {
    await run(() => notifyFollowersOfPost({ ...store, postId: "post123456", caption: "Hi" }));
    expect(m.push).toHaveBeenCalledTimes(1);
    expect(m.push.mock.calls[0][0]).toBe("ada1");
  });
  it("does nothing when nobody signed-in follows", async () => {
    m.prisma.browseFollow.findMany.mockResolvedValue([]);
    await run(() => notifyFollowersOfPost({ ...store, postId: "post123456", caption: "Hi" }));
    expect(m.prisma.notification.createMany).not.toHaveBeenCalled();
  });
  it("never throws when the database fails", async () => {
    m.prisma.browseFollow.findMany.mockRejectedValue(new Error("db down"));
    await expect(run(() => notifyFollowersOfPost({ ...store, postId: "post123456", caption: "Hi" }))).resolves.toBeUndefined();
  });
});

describe("notifyFollowersOfStory", () => {
  it("links to the business profile", async () => {
    await run(() => notifyFollowersOfStory(store));
    expect(m.prisma.notification.createMany.mock.calls[0][0].data[0]).toMatchObject({ type: "BROWSE_STORY", body: "Added a new story", url: "/browse/s/amala-hub" });
  });
});
