import { describe, expect, it } from "vitest";
import { decayed, EMPTY_INTERESTS, forYouScore, type ForYouInput } from "@/lib/browse-foryou";

const now = new Date("2026-11-10T12:00:00Z");
const post = (over: Partial<ForYouInput> = {}): ForYouInput => ({
  id: "p1", storeId: "s1", category: "Fashion", hashtags: ["ankara"], createdAt: new Date(now.getTime() - 3 * 3_600_000),
  likeCount: 5, commentCount: 1, ...over,
});

describe("forYouScore", () => {
  it("lifts a post that matches what the viewer likes", () => {
    const none = EMPTY_INTERESTS();
    const fan = EMPTY_INTERESTS();
    fan.categories.set("Fashion", 12);
    fan.tags.set("ankara", 8);
    expect(forYouScore(post(), fan, now)).toBeGreaterThan(forYouScore(post(), none, now) * 1.5);
  });

  it("ranks an interest match above an unrelated post of similar age and popularity", () => {
    const i = EMPTY_INTERESTS();
    i.stores.set("s1", 15);
    expect(forYouScore(post({ id: "a" }), i, now)).toBeGreaterThan(forYouScore(post({ id: "b", storeId: "s2", category: "Food", hashtags: [] }), i, now));
  });

  it("still prefers fresh posts when nothing is known about the viewer", () => {
    const i = EMPTY_INTERESTS();
    const fresh = forYouScore(post({ id: "x" }), i, now);
    const old = forYouScore(post({ id: "x", createdAt: new Date(now.getTime() - 10 * 86_400_000) }), i, now);
    expect(fresh).toBeGreaterThan(old);
  });

  it("sinks reported posts", () => {
    const i = EMPTY_INTERESTS();
    expect(forYouScore(post({ openReports: 2 }), i, now)).toBeLessThan(forYouScore(post(), i, now) / 3);
  });
});

describe("decayed", () => {
  it("halves every two weeks", () => {
    expect(decayed(10, new Date(now.getTime() - 14 * 86_400_000), now)).toBeCloseTo(5, 5);
  });
});
