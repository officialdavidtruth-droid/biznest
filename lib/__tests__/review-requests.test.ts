import { describe, expect, it } from "vitest";
import { isDueForReviewRequest, reviewRequestWindow } from "@/lib/review-requests";

const now = new Date("2026-11-10T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("review request timing", () => {
  it("is not due before 3 days have passed", () => {
    expect(isDueForReviewRequest(daysAgo(1), now)).toBe(false);
    expect(isDueForReviewRequest(new Date(daysAgo(3).getTime() + 1000), now)).toBe(false);
  });
  it("is due from 3 days after finishing", () => {
    expect(isDueForReviewRequest(daysAgo(3), now)).toBe(true);
    expect(isDueForReviewRequest(daysAgo(10), now)).toBe(true);
  });
  it("never goes back further than 30 days, so enabling the feature doesn't blast old customers", () => {
    expect(isDueForReviewRequest(daysAgo(30), now)).toBe(true);
    expect(isDueForReviewRequest(daysAgo(31), now)).toBe(false);
    expect(isDueForReviewRequest(daysAgo(400), now)).toBe(false);
  });
  it("exposes the window bounds used by the job's queries", () => {
    const w = reviewRequestWindow(now);
    expect(w.notAfter).toEqual(daysAgo(3));
    expect(w.notBefore).toEqual(daysAgo(30));
  });
});
