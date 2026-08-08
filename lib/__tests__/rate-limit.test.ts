import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the RateLimitEntry table so we can exercise the
// real fixed-window logic in lib/rate-limit.ts without a Postgres instance.
type Entry = { key: string; count: number; resetAt: Date };
const store = new Map<string, Entry>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimitEntry: {
      findUnique: vi.fn(async ({ where: { key } }: { where: { key: string } }) => store.get(key) ?? null),
      upsert: vi.fn(async ({ where: { key }, create }: any) => {
        const entry = { key, count: create.count, resetAt: create.resetAt };
        store.set(key, entry);
        return entry;
      }),
      update: vi.fn(async ({ where: { key }, data }: any) => {
        const entry = store.get(key)!;
        entry.count += data.count.increment;
        return entry;
      }),
    },
  },
}));

import { checkRateLimit, getClientIp } from "../rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    store.clear();
  });

  it("allows the first request in a fresh window", async () => {
    const result = await checkRateLimit("test:1", 3, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("allows up to `max` requests within the window", async () => {
    await checkRateLimit("test:2", 3, 60_000);
    await checkRateLimit("test:2", 3, 60_000);
    const third = await checkRateLimit("test:2", 3, 60_000);
    expect(third.allowed).toBe(true);
  });

  it("blocks the (max+1)th request within the window", async () => {
    await checkRateLimit("test:3", 2, 60_000);
    await checkRateLimit("test:3", 2, 60_000);
    const blocked = await checkRateLimit("test:3", 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the window once resetAt has passed", async () => {
    await checkRateLimit("test:4", 1, 10);
    // Manually expire the window rather than sleeping in the test.
    const entry = store.get("test:4")!;
    entry.resetAt = new Date(Date.now() - 1000);

    const result = await checkRateLimit("test:4", 1, 10);
    expect(result.allowed).toBe(true);
  });

  it("tracks separate buckets independently by key", async () => {
    await checkRateLimit("bucket:a", 1, 60_000);
    const blockedA = await checkRateLimit("bucket:a", 1, 60_000);
    const allowedB = await checkRateLimit("bucket:b", 1, 60_000);

    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(headers)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when neither header is present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
