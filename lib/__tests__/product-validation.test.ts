import { describe, expect, it } from "vitest";
import { productSchema } from "@/lib/validations/product";
import { variantOptionSchema } from "@/lib/validations/variant";

const base = {
  name: "Ankara Tote",
  type: "PHYSICAL" as const,
  description: "A sturdy handmade tote bag.",
  price: 5000,
  images: [] as string[],
};

describe("productSchema", () => {
  it("accepts a minimal valid product and defaults currency to NGN", () => {
    const r = productSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.currency).toBe("NGN");
  });

  it("uppercases and validates the currency code", () => {
    const ok = productSchema.safeParse({ ...base, currency: "usd" });
    expect(ok.success && ok.data.currency).toBe("USD");
    expect(productSchema.safeParse({ ...base, currency: "ZZZZ" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, currency: "N1" }).success).toBe(false);
  });

  it("requires compare-at price to be higher than price", () => {
    expect(productSchema.safeParse({ ...base, compareAtPrice: 4000 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, compareAtPrice: 5000 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, compareAtPrice: 6000 }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, compareAtPrice: "" }).success).toBe(true);
  });

  it("rejects prices and quantities beyond the column limits", () => {
    expect(productSchema.safeParse({ ...base, price: 1_000_000_000 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, quantity: 2_000_000 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, quantity: -1 }).success).toBe(false);
  });

  it("only allows http(s) image links", () => {
    expect(productSchema.safeParse({ ...base, images: ["https://res.cloudinary.com/x/a.jpg"] }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, images: ["javascript:alert(1)"] }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, images: ["data:text/html;base64,AAAA"] }).success).toBe(false);
  });

  it("accepts a private digital file reference", () => {
    expect(productSchema.safeParse({ ...base, type: "DIGITAL", digitalFileUrl: "private-asset://biznest/u1/digital/guide.pdf" }).success).toBe(true);
  });

  it("only accepts well-formed digital file references", () => {
    const d = { ...base, type: "DIGITAL" as const };
    expect(productSchema.safeParse({ ...d, digitalFileUrl: "private-asset://biznest/user1/digital/a.zip" }).success).toBe(true);
    expect(productSchema.safeParse({ ...d, digitalFileUrl: "private-asset://other/place/a.zip" }).success).toBe(false);
    expect(productSchema.safeParse({ ...d, digitalFileUrl: "private-asset://biznest/user1/kyc/id.pdf" }).success).toBe(false);
    expect(productSchema.safeParse({ ...d, digitalFileUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(productSchema.safeParse({ ...d, digitalFileUrl: "https://example.com/a.pdf" }).success).toBe(true);
  });

  it("caps the size of free-form attributes", () => {
    expect(productSchema.safeParse({ ...base, attributes: { longDescription: "x".repeat(300_000) } }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, attributes: { longDescription: "x".repeat(1_000) } }).success).toBe(true);
  });
});

describe("variantOptionSchema", () => {
  it("limits values per option", () => {
    const values = Array.from({ length: 31 }, (_, i) => `v${i}`);
    expect(variantOptionSchema.safeParse({ name: "Size", values }).success).toBe(false);
    expect(variantOptionSchema.safeParse({ name: "Size", values: values.slice(0, 30) }).success).toBe(true);
  });
});
