import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { setSession, clearSession } from "@/vitest.setup";
import { createPosSale } from "@/lib/actions/pos";
import { issueRefund } from "@/lib/actions/refund";
import { cleanupTestStore, createTestProduct, createTestStoreWithOwner, type TestStoreFixture } from "./fixtures";

/**
 * issueRefund's CASH/POS branch — the online-gateway branches (Paystack/
 * Flutterwave refundPayment) aren't covered here since they require live
 * gateway credentials; this focuses on the path that's pure DB state,
 * which is also the path that accrues/reverses Store.posCommissionOwed.
 */
describe("issueRefund (CASH/POS)", () => {
  let fixture: TestStoreFixture;

  beforeEach(async () => {
    fixture = await createTestStoreWithOwner({ commissionRate: 10 });
    setSession({ id: fixture.ownerUser.id, email: fixture.ownerUser.email, role: "STORE_OWNER" });
  });

  afterEach(async () => {
    clearSession();
    await cleanupTestStore(fixture);
  });

  async function ringUpSale(quantity = 1) {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 10 });
    const sale = await createPosSale(fixture.store.slug, {
      items: [{ productId: product.id, quantity }],
      tenderType: "Cash",
    });
    if (!sale.success) throw new Error("fixture sale failed: " + sale.error);
    return { product, orderId: sale.data.orderId };
  }

  it("marks the payment and order refunded", async () => {
    const { orderId } = await ringUpSale(1);

    const result = await issueRefund(fixture.store.slug, orderId, "Customer changed their mind");
    expect(result.success).toBe(true);

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
    expect(order?.status).toBe("REFUNDED");
    expect(order?.payments[0]?.status).toBe("REFUNDED");
    expect(order?.payments[0]?.refundedAmount).not.toBeNull();

    const event = await prisma.orderStatusEvent.findFirst({ where: { orderId, status: "REFUNDED" } });
    expect(event?.note).toMatch(/cash\/pos refund/i);
  });

  it("reverses the accrued POS commission balance", async () => {
    const { orderId } = await ringUpSale(1); // 1000 * 10% = 100 commission accrued

    const before = await prisma.store.findUnique({ where: { id: fixture.store.id }, select: { posCommissionOwed: true } });
    expect(Number(before?.posCommissionOwed)).toBe(100);

    const result = await issueRefund(fixture.store.slug, orderId, "Refunded");
    expect(result.success).toBe(true);

    const after = await prisma.store.findUnique({ where: { id: fixture.store.id }, select: { posCommissionOwed: true } });
    expect(Number(after?.posCommissionOwed)).toBe(0);
  });

  it("never takes the commission balance negative if some of it was already settled", async () => {
    const { orderId } = await ringUpSale(1); // accrues 100

    // Simulate the owner having already settled the whole balance via
    // recordPosCommissionSettlement before the refund happens.
    await prisma.store.update({ where: { id: fixture.store.id }, data: { posCommissionOwed: 0 } });

    const result = await issueRefund(fixture.store.slug, orderId, "Refunded after settlement");
    expect(result.success).toBe(true);

    const after = await prisma.store.findUnique({ where: { id: fixture.store.id }, select: { posCommissionOwed: true } });
    expect(Number(after?.posCommissionOwed)).toBe(0); // floored, not negative
  });

  it("rejects refunding the same order twice", async () => {
    const { orderId } = await ringUpSale(1);

    const first = await issueRefund(fixture.store.slug, orderId, "First refund");
    expect(first.success).toBe(true);

    const second = await issueRefund(fixture.store.slug, orderId, "Second attempt");
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.error).toMatch(/already been refunded/i);
  });

  it("requires a non-empty reason", async () => {
    const { orderId } = await ringUpSale(1);

    const result = await issueRefund(fixture.store.slug, orderId, "   ");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/reason is required/i);
  });

  it("rejects a refund attempt from someone with no access to the store", async () => {
    const { orderId } = await ringUpSale(1);
    const otherStore = await createTestStoreWithOwner();
    setSession({ id: otherStore.ownerUser.id, email: otherStore.ownerUser.email, role: "STORE_OWNER" });

    const result = await issueRefund(fixture.store.slug, orderId, "Trying to refund someone else's order");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/don't have access/i);

    await cleanupTestStore(otherStore);
  });
});
