import { describe, expect, it } from "vitest";
import {
  AD_FEED_EVERY, AD_FREQ_CAP, AD_MAX_BUDGET, AD_MIN_BUDGET, AD_RATE_PER_1000, adReference, ctr, impressionsFor, injectAds, injectRingAds, isAdLive,
  overFrequencyCap, parseAdReference, pickAds, sanitizeAd, spentNaira,
} from "@/lib/ads";

const good = { placement: "FEED", caption: "Fresh bread daily", imageUrl: "https://img.example.com/a.jpg", ctaLabel: "SHOP_NOW", budget: 5000, durationDays: 7 };

describe("pricing", () => {
  it("buys impressions at the placement rate", () => {
    expect(impressionsFor(1500, 1500)).toBe(1000);
    expect(impressionsFor(5000, AD_RATE_PER_1000.STORY)).toBe(2500);
    expect(impressionsFor(0, 1500)).toBe(0);
  });
  it("spend never passes the budget", () => {
    expect(spentNaira(500, 2000, 5000)).toBe(1000);
    expect(spentNaira(99999, 2000, 5000)).toBe(5000);
  });
  it("click rate is a one-decimal percentage", () => {
    expect(ctr(0, 0)).toBe(0);
    expect(ctr(7, 200)).toBe(3.5);
  });
});

describe("sanitizeAd", () => {
  it("accepts a good feed ad and freezes the rate and impressions", () => {
    const r = sanitizeAd(good);
    expect(r.ok && r.ad).toMatchObject({ placement: "FEED", budget: 5000, rate: AD_RATE_PER_1000.FEED, impressions: 3333, durationDays: 7, bgColor: null });
  });
  it("feed ads need a photo; story ads can be text cards", () => {
    expect(sanitizeAd({ ...good, imageUrl: undefined }).ok).toBe(false);
    const t = sanitizeAd({ ...good, placement: "STORY", imageUrl: undefined, caption: "20% off today" });
    expect(t.ok && t.ad.imageUrl).toBeNull();
    expect(t.ok && t.ad.bgColor).toBeTruthy();
  });
  it("rejects links, bad photos, empty ads, odd durations and out-of-range budgets", () => {
    expect(sanitizeAd({ ...good, caption: "Order at www.example.com" }).ok).toBe(false);
    expect(sanitizeAd({ ...good, imageUrl: "http://x.example.com/a.jpg" }).ok).toBe(false);
    expect(sanitizeAd({ placement: "STORY", budget: 5000, durationDays: 7 }).ok).toBe(false);
    expect(sanitizeAd({ ...good, durationDays: 5 }).ok).toBe(false);
    expect(sanitizeAd({ ...good, budget: AD_MIN_BUDGET - 1 }).ok).toBe(false);
    expect(sanitizeAd({ ...good, budget: AD_MAX_BUDGET + 1 }).ok).toBe(false);
    expect(sanitizeAd({ ...good, budget: "abc" }).ok).toBe(false);
    expect(sanitizeAd({ ...good, placement: "BANNER" }).ok).toBe(false);
  });
  it("falls back to a known button label", () => {
    const r = sanitizeAd({ ...good, ctaLabel: "<script>" });
    expect(r.ok && r.ad.ctaLabel).toBe("SHOP_NOW");
  });
});

describe("references", () => {
  it("round-trips even when the nonce contains dashes", () => {
    const ref = adReference("clx9abc123", "a-b_c-d1");
    expect(ref).toBe("ADS-clx9abc123-a-b_c-d1");
    expect(parseAdReference(ref)).toEqual({ campaignId: "clx9abc123" });
  });
  it("rejects other prefixes and malformed references", () => {
    expect(parseAdReference("PLUG-x-y-12345678")).toBeNull();
    expect(parseAdReference("ADS-short")).toBeNull();
    expect(parseAdReference("ADS-abc12345678")).toBeNull();
  });
});

describe("delivery rules", () => {
  const now = new Date("2026-12-01T10:00:00Z");
  const base = { status: "ACTIVE", impressions: 10, impressionsBought: 100, startsAt: new Date("2026-12-01T09:00:00Z"), endsAt: new Date("2026-12-05T09:00:00Z") };
  it("is live only while active, in budget and in date", () => {
    expect(isAdLive(base, now)).toBe(true);
    expect(isAdLive({ ...base, status: "PAUSED" }, now)).toBe(false);
    expect(isAdLive({ ...base, impressions: 100 }, now)).toBe(false);
    expect(isAdLive({ ...base, endsAt: new Date("2026-12-01T09:59:00Z") }, now)).toBe(false);
    expect(isAdLive({ ...base, startsAt: new Date("2026-12-01T11:00:00Z") }, now)).toBe(false);
  });
  it("caps how often one viewer sees a campaign per day", () => {
    expect(overFrequencyCap(null, now)).toBe(false);
    expect(overFrequencyCap({ seen: AD_FREQ_CAP, windowStart: new Date("2026-12-01T08:00:00Z") }, now)).toBe(true);
    expect(overFrequencyCap({ seen: AD_FREQ_CAP - 1, windowStart: new Date("2026-12-01T08:00:00Z") }, now)).toBe(false);
    expect(overFrequencyCap({ seen: AD_FREQ_CAP, windowStart: new Date("2026-11-30T09:00:00Z") }, now)).toBe(false); // window expired
  });
  it("favours campaigns with more budget left per hour", () => {
    const a = { id: "a", impressions: 0, impressionsBought: 1000, endsAt: new Date("2026-12-02T10:00:00Z") };
    const b = { id: "b", impressions: 900, impressionsBought: 1000, endsAt: new Date("2026-12-02T10:00:00Z") };
    expect(pickAds([b, a], 1, now, () => 0)[0].id).toBe("a");
    expect(pickAds([b, a], 5, now, () => 0)).toHaveLength(2);
    expect(pickAds([a], 0, now)).toEqual([]);
  });
});

describe("placement", () => {
  it("puts one ad after every N posts and keeps the rhythm across pages", () => {
    const posts = Array.from({ length: 10 }, (_, i) => i);
    const out = injectAds(posts, ["x", "y", "z"], AD_FEED_EVERY);
    expect(out.map((o) => (o.type === "ad" ? o.ad : o.post))).toEqual([0, 1, 2, 3, 4, "x", 5, 6, 7, 8, 9, "y"]);
    const next = injectAds([10, 11, 12, 13, 14], ["z"], AD_FEED_EVERY, 10);
    expect(next.map((o) => (o.type === "ad" ? o.ad : o.post))).toEqual([10, 11, 12, 13, 14, "z"]);
  });
  it("never invents ads when there are none", () => {
    expect(injectAds([1, 2, 3, 4, 5, 6], [], 5).every((o) => o.type === "post")).toBe(true);
  });
  it("puts sponsored rings second, then every fourth, and shows ads alone if there are no rings", () => {
    const out = injectRingAds(["r0", "r1", "r2", "r3", "r4", "r5"], ["A", "B"]);
    expect(out.map((o) => o.ring ?? o.ad)).toEqual(["r0", "A", "r1", "r2", "r3", "r4", "B", "r5"]);
    expect(injectRingAds([], ["A"]).map((o) => o.ad)).toEqual(["A"]);
  });
});
