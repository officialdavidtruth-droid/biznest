import { describe, it, expect } from "vitest";
import { productSchema } from "@/lib/validations/product";

const base = { name: "iPhone 12", type: "PHYSICAL", description: "A fine phone for everyday use", price: 100, currency: "NGN", images: [], isPublished: true, quantity: 1 };
const id = (n: number) => `c${String(n).padStart(24, "0")}`;

describe("product categories", () => {
  it("accepts several categories", () => {
    const r = productSchema.safeParse({ ...base, categoryId: id(1), categoryIds: [id(1), id(2)] });
    expect(r.success).toBe(true);
  });
  it("still accepts the old single category and none at all", () => {
    expect(productSchema.safeParse({ ...base, categoryId: id(1) }).success).toBe(true);
    expect(productSchema.safeParse({ ...base }).success).toBe(true);
  });
  it("rejects junk ids", () => {
    expect(productSchema.safeParse({ ...base, categoryIds: ["nope"] }).success).toBe(false);
  });
});
