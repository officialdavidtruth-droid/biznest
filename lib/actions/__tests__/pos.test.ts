import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPosSale, getPosCommissionBalance, recordPosCommissionSettlement } from "@/lib/actions/pos";
import { clearSession, setSession } from "@/vitest.setup";
import {
  cleanupTestStore,
  createTestProduct,
  createTestVariant,
  createTestStoreWithOwner,
  type TestStoreFixture,
} from "./fixtures";

/**
 * Integration tests against a real database (see TESTING.md) — these
 * exercise createPosSale's actual $transaction, including the guarded
 * stock decrement that's supposed to prevent overselling under
 * concurrency. A mocked Prisma client couldn't catch a bug in that
 * transaction; only a real one can.
 */
describe("createPosSale", () => {
  let fixture: TestStoreFixture;

  beforeEach(async () => {
    fixture = await createTestStoreWithOwner({ commissionRate: 10 });
    setSession({ id: fixture.ownerUser.id, email: fixture.ownerUser.email, role: "STORE_OWNER" });
  });

  afterEach(async () => {
    clearSession();
    await cleanupTestStore(fixture);
  });

  it("completes a sale: creates the order/payment, decrements stock, and accrues commission", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 10 });

    const result = await createPosSale(fixture.store.slug, {
      items: [{ productId: product.id, quantity: 2 }],
      tenderType: "Cash",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBe(2000);

    const order = await prisma.order.findUnique({
      where: { id: result.data.orderId },
      include: { items: true, payments: true },
    });
    expect(order?.status).toBe("PAID");
    expect(order?.channel).toBe("POS");
    expect(Number(order?.commission)).toBe(200); // 10% of 2000
    expect(order?.payments[0]?.status).toBe("SUCCESSFUL");
    expect(order?.payments[0]?.provider).toBe("CASH");

    const inventory = await prisma.inventoryItem.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(8);

    const movement = await prisma.stockMovement.findFirst({ where: { inventoryItemId: inventory?.id } });
    expect(movement?.quantityChange).toBe(-2);
    expect(movement?.quantityAfter).toBe(8);

    const balance = await getPosCommissionBalance(fixture.store.slug);
    expect(balance.owed).toBe(200);
  });

  it("decrements the right variant, leaving other variants and the parent untouched", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, hasVariants: true });
    const small = await createTestVariant(product.id, fixture.store.id, { label: "Small", quantity: 5, price: 900 });
    const large = await createTestVariant(product.id, fixture.store.id, { label: "Large", quantity: 5, price: 1100 });

    const result = await createPosSale(fixture.store.slug, {
      items: [{ variantId: small.id, quantity: 1 }],
      tenderType: "Card",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBe(900);

    const [smallAfter, largeAfter] = await Promise.all([
      prisma.productVariant.findUnique({ where: { id: small.id } }),
      prisma.productVariant.findUnique({ where: { id: large.id } }),
    ]);
    expect(smallAfter?.quantity).toBe(4);
    expect(largeAfter?.quantity).toBe(5);
  });

  it("rejects a sale for more than what's in stock, and leaves stock/order untouched", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 1 });

    const result = await createPosSale(fixture.store.slug, {
      items: [{ productId: product.id, quantity: 5 }],
      tenderType: "Cash",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not enough stock/i);

    const inventory = await prisma.inventoryItem.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(1);

    const orderCount = await prisma.order.count({ where: { storeId: fixture.store.id } });
    expect(orderCount).toBe(0);
  });

  it("marks a product's inventory auto-unpublished once a sale takes it to zero", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 1 });

    const result = await createPosSale(fixture.store.slug, {
      items: [{ productId: product.id, quantity: 1 }],
      tenderType: "Cash",
    });
    expect(result.success).toBe(true);

    const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    const inventory = await prisma.inventoryItem.findUnique({ where: { productId: product.id } });
    expect(updatedProduct?.isPublished).toBe(false);
    expect(inventory?.autoUnpublished).toBe(true);
  });

  it("under concurrent requests for the last unit, exactly one sale succeeds", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 1 });

    const [first, second] = await Promise.all([
      createPosSale(fixture.store.slug, { items: [{ productId: product.id, quantity: 1 }], tenderType: "Cash" }),
      createPosSale(fixture.store.slug, { items: [{ productId: product.id, quantity: 1 }], tenderType: "Cash" }),
    ]);

    const successes = [first, second].filter((r) => r.success);
    const failures = [first, second].filter((r) => !r.success);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const inventory = await prisma.inventoryItem.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(0);

    const orderCount = await prisma.order.count({ where: { storeId: fixture.store.id } });
    expect(orderCount).toBe(1);
  });

  it("rejects a sale from someone with no access to the store", async () => {
    const otherStore = await createTestStoreWithOwner();
    setSession({ id: otherStore.ownerUser.id, email: otherStore.ownerUser.email, role: "STORE_OWNER" });

    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 5 });
    const result = await createPosSale(fixture.store.slug, {
      items: [{ productId: product.id, quantity: 1 }],
      tenderType: "Cash",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/don't have access/i);

    await cleanupTestStore(otherStore);
  });
});

/**
 * Integration tests against a real database — these exercise the guarded
 * updateMany in recordPosCommissionSettlement that replaced a read-then-
 * write race (see the fix's changelog comment in lib/actions/pos.ts).
 */
describe("recordPosCommissionSettlement", () => {
  let fixture: TestStoreFixture;

  beforeEach(async () => {
    fixture = await createTestStoreWithOwner({ commissionRate: 10 });
    setSession({ id: fixture.ownerUser.id, email: fixture.ownerUser.email, role: "STORE_OWNER" });
  });

  afterEach(async () => {
    clearSession();
    await cleanupTestStore(fixture);
  });

  async function accrueCommission(amount: number) {
    // commissionRate is 10%, so a sale of `amount * 10` accrues exactly `amount`.
    const product = await createTestProduct(fixture.store.id, { price: amount * 10, quantity: 10 });
    const sale = await createPosSale(fixture.store.slug, {
      items: [{ productId: product.id, quantity: 1 }],
      tenderType: "Cash",
    });
    if (!sale.success) throw new Error("fixture sale failed: " + sale.error);
  }

  it("clears a partial settlement and leaves the remainder owed", async () => {
    await accrueCommission(300);

    const result = await recordPosCommissionSettlement(fixture.store.slug, 120, "Partial bank transfer");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.remainingOwed).toBe(180);

    const balance = await getPosCommissionBalance(fixture.store.slug);
    expect(balance.owed).toBe(180);
    expect(balance.recentSettlements[0]?.amount).toBe(120);
    expect(balance.recentSettlements[0]?.note).toBe("Partial bank transfer");
  });

  it("rejects settling more than what's currently owed", async () => {
    await accrueCommission(100);

    const result = await recordPosCommissionSettlement(fixture.store.slug, 150);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/more than the 100 currently owed/i);

    const balance = await getPosCommissionBalance(fixture.store.slug);
    expect(balance.owed).toBe(100); // untouched — the rejected attempt made no change
  });

  it("rejects a zero or negative settlement amount", async () => {
    await accrueCommission(100);

    const zero = await recordPosCommissionSettlement(fixture.store.slug, 0);
    expect(zero.success).toBe(false);

    const negative = await recordPosCommissionSettlement(fixture.store.slug, -50);
    expect(negative.success).toBe(false);
  });

  it("never lets two concurrent settlements together decrement past what was actually owed", async () => {
    // The bug this guards against: two requests both read "100 owed",
    // both individually look valid against that stale read (60 <= 100,
    // 70 <= 100), but 60 + 70 = 130 > 100 — without the fix, both could
    // succeed and take the balance negative. Fired concurrently via
    // Promise.all (not sequential awaits) so they actually race inside
    // the database rather than trivially serializing in JS.
    await accrueCommission(100);

    const [first, second] = await Promise.all([
      recordPosCommissionSettlement(fixture.store.slug, 60, "Attempt A"),
      recordPosCommissionSettlement(fixture.store.slug, 70, "Attempt B"),
    ]);

    const outcomes = [first, second];
    const succeeded = outcomes.filter((r) => r.success);
    const failed = outcomes.filter((r) => !r.success);

    // Exactly one of the two must have gone through — both succeeding
    // would mean 130 got decremented from a 100 balance.
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    const winningAmount = first.success ? 60 : 70;
    const balance = await getPosCommissionBalance(fixture.store.slug);
    expect(balance.owed).toBe(100 - winningAmount);
    expect(balance.owed).toBeGreaterThanOrEqual(0); // never negative
  });

  it("rejects a settlement attempt from someone with no access to the store", async () => {
    await accrueCommission(100);
    const otherStore = await createTestStoreWithOwner();
    setSession({ id: otherStore.ownerUser.id, email: otherStore.ownerUser.email, role: "STORE_OWNER" });

    const result = await recordPosCommissionSettlement(fixture.store.slug, 50);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/don't have access/i);

    await cleanupTestStore(otherStore);
  });
});
