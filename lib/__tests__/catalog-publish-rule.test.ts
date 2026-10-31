import { describe, expect, it } from "vitest";
import { decidePublishAfterStockChange as decide } from "@/lib/catalog/publish";

const base = { wasPublished: true, explicitPublish: false, requestedPublished: true, prevQuantity: 5, nextQuantity: 5, wasAutoUnpublished: false };

describe("decidePublishAfterStockChange (shared out-of-stock rule)", () => {
  it("leaves everything alone when stock doesn't cross zero", () => {
    expect(decide({ ...base, nextQuantity: 9 })).toMatchObject({ isPublished: true, autoUnpublished: false });
    expect(decide({ ...base, wasPublished: false, nextQuantity: 9 })).toMatchObject({ isPublished: false, autoUnpublished: false });
  });

  it("running out unpublishes and flags it as automatic", () => {
    expect(decide({ ...base, nextQuantity: 0 })).toMatchObject({ isPublished: false, autoUnpublished: true, justRanOut: true });
  });

  it("running out does not flag a listing the merchant had already hidden", () => {
    expect(decide({ ...base, wasPublished: false, nextQuantity: 0 })).toMatchObject({ isPublished: false, autoUnpublished: false });
  });

  it("running out in the same edit that unpublishes is the merchant's doing, not the automation's", () => {
    expect(decide({ ...base, explicitPublish: true, requestedPublished: false, nextQuantity: 0 })).toMatchObject({ isPublished: false, autoUnpublished: false });
  });

  it("restock republishes only what the automation took down", () => {
    const restock = { ...base, wasPublished: false, prevQuantity: 0, nextQuantity: 4 };
    expect(decide({ ...restock, wasAutoUnpublished: true })).toMatchObject({ isPublished: true, autoUnpublished: false });
    expect(decide({ ...restock, wasAutoUnpublished: false })).toMatchObject({ isPublished: false });
  });

  it("restock never overrides a publish choice made in the same edit", () => {
    const r = decide({ ...base, wasPublished: false, prevQuantity: 0, nextQuantity: 4, wasAutoUnpublished: true, explicitPublish: true, requestedPublished: false });
    expect(r.isPublished).toBe(false);
  });

  it("an explicit publish survives when stock doesn't cross zero", () => {
    expect(decide({ ...base, wasPublished: false, explicitPublish: true, requestedPublished: true }).isPublished).toBe(true);
  });
});
