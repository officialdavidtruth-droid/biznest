import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { setSession, clearSession } from "@/vitest.setup";
import { cleanupTestStore, createTestProduct, createTestStoreWithOwner, type TestStoreFixture } from "./fixtures";

/**
 * startCheckout talks to an external gateway (chargeCustomer/
 * getActiveGateway) — mocked here so these tests exercise the real DB
 * writes (order/payment creation, the post-charge transaction) without
 * needing live Paystack/Flutterwave credentials or network access. Every
 * other test file in this directory mocks auth/webhooks/activity the same
 * way via vitest.setup.ts; this just adds the one extra external boundary
 * this particular action has.
 */
vi.mock("@/lib/payments/gateway", () => ({
  chargeCustomer: vi.fn(async () => ({
    success: true as const,
    authorizationUrl: "https://checkout.example/pay/test",
    gateway: "PAYSTACK" as const,
  })),
  getActiveGateway: vi.fn(async () => "PAYSTACK" as const),
}));

import { chargeCustomer } from "@/lib/payments/gateway";
import { startCheckout, decrementStockForOrder } from "@/lib/actions/order";

function shippingAddress() {
  return { fullName: "Ada Lovelace", phone: "+2348000000000", address: "1 Analytical Engine Rd", city: "Lagos", state: "Lagos", country: "Nigeria" };
}

describe("startCheckout", () => {
  let fixture: TestStoreFixture;
  let buyerId: string;

  beforeEach(async () => {
    fixture = await createTestStoreWithOwner({ commissionRate: 10 });
    const buyer = await prisma.user.create({ data: { email: `buyer-${fixture.suffix}@test.biznest.internal`, role: "CUSTOMER" } });
    buyerId = buyer.id;
    setSession({ id: buyerId, email: buyer.email, role: "CUSTOMER" });
    vi.mocked(chargeCustomer).mockClear();
  });

  afterEach(async () => {
    clearSession();
    await prisma.user.deleteMany({ where: { id: buyerId } });
    await cleanupTestStore(fixture);
  });

  it("creates a PENDING_PAYMENT order, charges the gateway, and records a PENDING payment", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 2000, quantity: 5 });

    const result = await startCheckout(fixture.store.slug, {
      items: [{ productId: product.id, quantity: 2 }],
      shippingAddress: shippingAddress(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.authorizationUrl).toBe("https://checkout.example/pay/test");
    expect(chargeCustomer).toHaveBeenCalledTimes(1);

    const order = await prisma.order.findFirst({ where: { storeId: fixture.store.id }, include: { payments: true, items: true } });
    expect(order?.status).toBe("PENDING_PAYMENT");
    expect(Number(order?.subtotal)).toBe(4000);
    expect(Number(order?.commission)).toBe(400); // 10% of 4000
    expect(order?.paymentProvider).toBe("PAYSTACK");
    expect(order?.payments[0]?.status).toBe("PENDING");
    expect(order?.items).toHaveLength(1);

    // Not sold yet — checkout only reserves nothing and doesn't touch
    // stock; that only happens once payment is actually confirmed (see
    // decrementStockForOrder tests below).
    const inventory = await prisma.inventoryItem.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(5);
  });

  it("cancels the order and surfaces the error when the gateway charge fails", async () => {
    vi.mocked(chargeCustomer).mockResolvedValueOnce({ success: false, error: "Card declined" });
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 5 });

    const result = await startCheckout(fixture.store.slug, {
      items: [{ productId: product.id, quantity: 1 }],
      shippingAddress: shippingAddress(),
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Card declined");

    const order = await prisma.order.findFirst({ where: { storeId: fixture.store.id } });
    expect(order?.status).toBe("CANCELLED");
  });

  it("rejects checkout for a product that's no longer published", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 5 });
    await prisma.product.update({ where: { id: product.id }, data: { isPublished: false } });

    const result = await startCheckout(fixture.store.slug, {
      items: [{ productId: product.id, quantity: 1 }],
      shippingAddress: shippingAddress(),
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/no longer available/i);
    expect(chargeCustomer).not.toHaveBeenCalled();
  });

  it("rejects an empty/zero-value cart before ever calling the gateway", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 0, quantity: 5 });

    const result = await startCheckout(fixture.store.slug, {
      items: [{ productId: product.id, quantity: 1 }],
      shippingAddress: shippingAddress(),
    });

    expect(result.success).toBe(false);
    expect(chargeCustomer).not.toHaveBeenCalled();
  });

  it("hands back the same payment page instead of charging twice for an immediate duplicate submission", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 5 });
    const cart = { items: [{ productId: product.id, quantity: 2 }], shippingAddress: shippingAddress() };

    const first = await startCheckout(fixture.store.slug, cart);
    expect(first.success).toBe(true);

    const second = await startCheckout(fixture.store.slug, cart);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    // Same payment page handed back both times, and the gateway was only
    // ever actually charged once.
    expect(second.data.authorizationUrl).toBe(first.data.authorizationUrl);
    expect(chargeCustomer).toHaveBeenCalledTimes(1);

    const orderCount = await prisma.order.count({ where: { storeId: fixture.store.id } });
    expect(orderCount).toBe(1);
  });

  it("does not dedupe a different cart from the same buyer", async () => {
    const productA = await createTestProduct(fixture.store.id, { price: 1000, quantity: 5 });
    const productB = await createTestProduct(fixture.store.id, { price: 1500, quantity: 5 });

    const first = await startCheckout(fixture.store.slug, {
      items: [{ productId: productA.id, quantity: 1 }],
      shippingAddress: shippingAddress(),
    });
    expect(first.success).toBe(true);

    const second = await startCheckout(fixture.store.slug, {
      items: [{ productId: productB.id, quantity: 1 }],
      shippingAddress: shippingAddress(),
    });
    expect(second.success).toBe(true);

    expect(chargeCustomer).toHaveBeenCalledTimes(2);
    const orderCount = await prisma.order.count({ where: { storeId: fixture.store.id } });
    expect(orderCount).toBe(2);
  });

  it("does not dedupe against a previously cancelled (failed-charge) attempt — lets the retry through", async () => {
    vi.mocked(chargeCustomer).mockResolvedValueOnce({ success: false, error: "Card declined" });
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 5 });
    const cart = { items: [{ productId: product.id, quantity: 1 }], shippingAddress: shippingAddress() };

    const failed = await startCheckout(fixture.store.slug, cart);
    expect(failed.success).toBe(false);

    const retried = await startCheckout(fixture.store.slug, cart);
    expect(retried.success).toBe(true);
    expect(chargeCustomer).toHaveBeenCalledTimes(2);
  });
});

/**
 * decrementStockForOrder is called from inside the payment webhook/
 * callback routes' own transactions, never directly by user-facing code —
 * these tests call it the same way, wrapping it in a one-off transaction
 * to exercise the real function against a real order's items.
 */
describe("decrementStockForOrder", () => {
  let fixture: TestStoreFixture;
  let buyerId: string;

  beforeEach(async () => {
    fixture = await createTestStoreWithOwner({ commissionRate: 8 });
    const buyer = await prisma.user.create({ data: { email: `buyer2-${fixture.suffix}@test.biznest.internal`, role: "CUSTOMER" } });
    buyerId = buyer.id;
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: buyerId } });
    await cleanupTestStore(fixture);
  });

  async function createPaidOrder(productId: string, quantity: number) {
    return prisma.order.create({
      data: {
        storeId: fixture.store.id,
        buyerId,
        status: "PAID",
        subtotal: 1000 * quantity,
        commission: 0,
        total: 1000 * quantity,
        currency: "NGN",
        deliveryFee: 0,
        shippingAddress: shippingAddress(),
        items: { create: [{ productId, quantity, unitPrice: 1000 }] },
      },
    });
  }

  it("decrements the product's inventory and records a stock movement", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 10 });
    const order = await createPaidOrder(product.id, 3);

    await prisma.$transaction((tx) => decrementStockForOrder(tx, order.id));

    const inventory = await prisma.inventoryItem.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(7);

    const movement = await prisma.stockMovement.findFirst({ where: { inventoryItemId: inventory?.id } });
    expect(movement?.quantityChange).toBe(-3);
    expect(movement?.quantityAfter).toBe(7);
    expect(movement?.note).not.toMatch(/oversold/i);
  });

  it("floors at zero and notes an oversold sale rather than failing, since the customer was already charged", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 2 });
    const order = await createPaidOrder(product.id, 5); // more than the 2 in stock

    await prisma.$transaction((tx) => decrementStockForOrder(tx, order.id));

    const inventory = await prisma.inventoryItem.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(0);

    const movement = await prisma.stockMovement.findFirst({ where: { inventoryItemId: inventory?.id } });
    expect(movement?.note).toMatch(/oversold/i);

    const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProduct?.isPublished).toBe(false);
  });

  it("is a no-op for a product with no tracked inventory", async () => {
    const product = await prisma.product.create({
      data: { storeId: fixture.store.id, name: "Digital thing", slug: `digital-${fixture.suffix}`, price: 500, type: "DIGITAL" },
    });
    const order = await createPaidOrder(product.id, 1);

    // Should resolve cleanly with nothing to decrement, not throw.
    await expect(prisma.$transaction((tx) => decrementStockForOrder(tx, order.id))).resolves.not.toThrow();
  });
});
