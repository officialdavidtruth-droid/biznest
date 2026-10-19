import { describe, expect, it } from "vitest";
import {
  abandonedCheckoutSubject,
  readableTextOn,
  renderAbandonedCheckoutEmail,
  safeBrandColor,
  safeFromName,
} from "@/lib/email/abandoned-checkout-email";

const base = {
  recipientEmail: "buyer@example.com",
  recipientName: "Destiny Sidi",
  store: { name: "Velox Space", slug: "velox-space", primaryColor: "#7c3aed", contactEmail: "hello@velox.test" },
  items: [{ name: "Lol", quantity: 2, unitPrice: 2500 }],
  currency: "NGN",
  total: 5000,
  cartUrl: "https://www.biznest.space/velox-space/cart",
  appUrl: "https://www.biznest.space",
};

describe("renderAbandonedCheckoutEmail", () => {
  it("is branded with the store, not BizNest", () => {
    const html = renderAbandonedCheckoutEmail(base);
    expect(html).toContain("Velox Space");
    expect(html).toContain("#7c3aed");
    expect(html).toContain("Destiny, your cart is waiting");
    expect(html).not.toContain("email-logo.png");
    expect(abandonedCheckoutSubject("Velox Space")).toBe("You left something in your cart at Velox Space");
  });

  it("shows the logo when the store has one, the store name as a wordmark when it doesn't", () => {
    expect(renderAbandonedCheckoutEmail({ ...base, store: { ...base.store, logoUrl: "https://cdn.test/logo.png" } })).toContain('src="https://cdn.test/logo.png"');
    expect(renderAbandonedCheckoutEmail(base)).not.toContain("<img");
  });

  it("escapes store and product names", () => {
    const html = renderAbandonedCheckoutEmail({ ...base, store: { ...base.store, name: "A<b>&Co" }, items: [{ name: "<script>x</script>", quantity: 1, unitPrice: 1 }] });
    expect(html).not.toContain("<script>x");
    expect(html).toContain("A&lt;b&gt;&amp;Co");
  });

  it("caps long carts and falls back on bad brand colours", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ name: `Item ${i}`, quantity: 1, unitPrice: 100 }));
    expect(renderAbandonedCheckoutEmail({ ...base, items })).toContain("+ 2 more items");
    expect(safeBrandColor("red; background:url(x)")).toBe("#0f6410");
    expect(safeBrandColor("#abc")).toBe("#aabbcc");
  });

  it("picks readable text on light and dark brand colours", () => {
    expect(readableTextOn("#ffffff")).toBe("#111827");
    expect(readableTextOn("#0f6410")).toBe("#ffffff");
  });

  it("keeps the From display name header-safe", () => {
    expect(safeFromName('Evil" <x@y.z>, Store')).not.toMatch(/["<>,]/);
  });
});
