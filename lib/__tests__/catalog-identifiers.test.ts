import { beforeEach, describe, expect, it, vi } from "vitest";

const inventoryFindFirst = vi.fn();
const variantFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    inventoryItem: { findFirst: (...a: unknown[]) => inventoryFindFirst(...a) },
    productVariant: { findFirst: (...a: unknown[]) => variantFindFirst(...a) },
  },
}));

import { findIdentifierClash, clashResult } from "@/lib/catalog-identifiers";

beforeEach(() => {
  inventoryFindFirst.mockReset().mockResolvedValue(null);
  variantFindFirst.mockReset().mockResolvedValue(null);
});

describe("findIdentifierClash", () => {
  it("returns null when nothing is supplied or nothing clashes", async () => {
    expect(await findIdentifierClash("s1", {})).toBeNull();
    expect(await findIdentifierClash("s1", { sku: "A1", barcode: "123" })).toBeNull();
  });

  it("detects a product SKU that a variant already uses", async () => {
    variantFindFirst.mockResolvedValueOnce({ id: "var1" });
    expect(await findIdentifierClash("s1", { sku: "A1" })).toEqual({ field: "sku" });
  });

  it("detects a variant barcode that a plain product already uses", async () => {
    inventoryFindFirst.mockResolvedValueOnce({ id: "inv1" });
    expect(await findIdentifierClash("s1", { barcode: "999" })).toEqual({ field: "barcode" });
  });

  it("excludes the record being edited", async () => {
    await findIdentifierClash("s1", { sku: "A1" }, { productId: "p1", variantId: "v1" });
    expect(inventoryFindFirst.mock.calls[0][0].where.NOT).toEqual({ productId: "p1" });
    expect(variantFindFirst.mock.calls[0][0].where.NOT).toEqual({ id: "v1" });
  });

  it("formats a field error", () => {
    expect(clashResult({ field: "sku" })).toMatchObject({ success: false, error: "That SKU is already in use.", fieldErrors: { sku: ["Already in use"] } });
  });
});
