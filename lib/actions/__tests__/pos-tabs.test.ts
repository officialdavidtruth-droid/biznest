import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPosSale } from "@/lib/actions/pos";
import { getOpenPosTabs, postPosTabToRoom, settlePosTab } from "@/lib/actions/pos-tabs";
import { settleFolio } from "@/lib/actions/folio";
import { clearSession, setSession } from "@/vitest.setup";
import { cleanupTestStore, createTestProduct, createTestStoreWithOwner, type TestStoreFixture } from "./fixtures";

// Production commission is 0% by design (lib/constants/commission.ts). These
// tests exercise the commission accrual/settlement/refund mechanics, so they
// pin the rate to 10%, matching the fixtures' subscription commissionRate.
vi.mock("@/lib/constants/commission", () => ({ PLATFORM_COMMISSION_PERCENT: 10 }));


/**
 * Integration tests (real database, see TESTING.md) for charging a POS sale to a table's
 * running bill or to a guest's room instead of paying on the spot.
 */
describe("POS table tabs and room charges", () => {
  let fixture: TestStoreFixture;

  beforeEach(async () => {
    fixture = await createTestStoreWithOwner({ commissionRate: 10 });
    setSession({ id: fixture.ownerUser.id, email: fixture.ownerUser.email, role: "STORE_OWNER" });
  });

  afterEach(async () => {
    clearSession();
    await prisma.propertyFolioCharge.deleteMany({ where: { storeId: fixture.store.id } });
    await cleanupTestStore(fixture);
  });

  const sale = (slug: string, productId: string, quantity: number, extra: Record<string, unknown>) =>
    createPosSale(slug, { items: [{ productId, quantity }], tenderType: "Cash", orderType: "DINE_IN", ...extra } as never);

  it("accumulates several rounds on one table tab without recording any payment", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 20 });

    const first = await sale(fixture.store.slug, product.id, 2, { tableLabel: "Table 5", chargeTo: { kind: "TABLE" } });
    const second = await sale(fixture.store.slug, product.id, 1, { tableLabel: "  table   5 ", chargeTo: { kind: "TABLE" } });
    expect(first.success && second.success).toBe(true);

    expect(await prisma.posTab.count({ where: { storeId: fixture.store.id } })).toBe(1);
    expect(await prisma.payment.count({ where: { storeId: fixture.store.id } })).toBe(0);

    const [tab] = await getOpenPosTabs(fixture.store.slug);
    expect(tab.label).toBe("Table 5");
    expect(tab.orders).toHaveLength(2);
    expect(tab.total).toBe(3000);

    // Stock is taken and commission accrues when the food is ordered, not when the bill is paid.
    const inventory = await prisma.inventoryItem.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(17);
    const store = await prisma.store.findUnique({ where: { id: fixture.store.id } });
    expect(Number(store?.posCommissionOwed)).toBe(300);
  });

  it("needs a table to add to a tab", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 5 });
    const result = await sale(fixture.store.slug, product.id, 1, { chargeTo: { kind: "TABLE" } });
    expect(result.success).toBe(false);
  });

  it("settles the whole tab once: a Payment per order, tab closed, second settle refused", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 20 });
    await sale(fixture.store.slug, product.id, 2, { tableLabel: "Table 5", chargeTo: { kind: "TABLE" } });
    await sale(fixture.store.slug, product.id, 1, { tableLabel: "Table 5", chargeTo: { kind: "TABLE" } });
    const [tab] = await getOpenPosTabs(fixture.store.slug);

    const paid = await settlePosTab(fixture.store.slug, tab.id, "Card");
    expect(paid.success).toBe(true);
    if (paid.success) expect(paid.data.total).toBe(3000);

    const payments = await prisma.payment.findMany({ where: { storeId: fixture.store.id } });
    expect(payments).toHaveLength(2);
    expect(payments.every((p) => p.status === "SUCCESSFUL")).toBe(true);
    expect((await prisma.posTab.findUnique({ where: { id: tab.id } }))?.status).toBe("SETTLED");
    expect(await getOpenPosTabs(fixture.store.slug)).toHaveLength(0);

    const again = await settlePosTab(fixture.store.slug, tab.id, "Card");
    expect(again.success).toBe(false);
    expect(await prisma.payment.count({ where: { storeId: fixture.store.id } })).toBe(2);
  });

  it("starts a fresh tab for the table after the old one is paid", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 500, quantity: 20 });
    await sale(fixture.store.slug, product.id, 1, { tableLabel: "Table 9", chargeTo: { kind: "TABLE" } });
    const [first] = await getOpenPosTabs(fixture.store.slug);
    await settlePosTab(fixture.store.slug, first.id, "Cash");

    await sale(fixture.store.slug, product.id, 1, { tableLabel: "Table 9", chargeTo: { kind: "TABLE" } });
    const [second] = await getOpenPosTabs(fixture.store.slug);
    expect(second.id).not.toBe(first.id);
    expect(second.total).toBe(500);
  });

  async function checkedInGuest() {
    const room = await prisma.propertyRoom.create({ data: { storeId: fixture.store.id, name: "101", roomType: "Standard" } });
    const guest = await prisma.propertyGuest.create({ data: { storeId: fixture.store.id, fullName: "Ada Guest" } });
    return prisma.propertyReservation.create({
      data: {
        storeId: fixture.store.id,
        roomId: room.id,
        guestId: guest.id,
        checkIn: new Date(Date.now() - 86_400_000),
        checkOut: new Date(Date.now() + 86_400_000),
        status: "CHECKED_IN",
      },
    });
  }

  it("charges a sale straight to a checked-in guest's room and records the payment at checkout", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1500, quantity: 10 });
    const reservation = await checkedInGuest();

    const result = await sale(fixture.store.slug, product.id, 2, { chargeTo: { kind: "ROOM", reservationId: reservation.id } });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const charges = await prisma.propertyFolioCharge.findMany({ where: { reservationId: reservation.id } });
    expect(charges.reduce((s, c) => s + Number(c.amount), 0)).toBe(3000);
    expect(charges.every((c) => c.sourceType === "ORDER" && c.sourceId === result.data.orderId && c.status === "OPEN")).toBe(true);
    expect(await prisma.payment.count({ where: { orderId: result.data.orderId } })).toBe(0);

    const settled = await settleFolio(fixture.store.slug, reservation.id, "Card at checkout");
    expect(settled.success).toBe(true);
    expect(await prisma.payment.count({ where: { orderId: result.data.orderId, status: "SUCCESSFUL" } })).toBe(1);
  });

  it("refuses a room that isn't checked in", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1500, quantity: 10 });
    const reservation = await checkedInGuest();
    await prisma.propertyReservation.update({ where: { id: reservation.id }, data: { status: "CHECKED_OUT" } });

    const result = await sale(fixture.store.slug, product.id, 1, { chargeTo: { kind: "ROOM", reservationId: reservation.id } });
    expect(result.success).toBe(false);
    expect((await prisma.inventoryItem.findUnique({ where: { productId: product.id } }))?.quantity).toBe(10);
  });

  it("moves a whole table tab onto a guest's room", async () => {
    const product = await createTestProduct(fixture.store.id, { price: 1000, quantity: 20 });
    const reservation = await checkedInGuest();
    await sale(fixture.store.slug, product.id, 2, { tableLabel: "Bar 1", chargeTo: { kind: "TABLE" } });
    await sale(fixture.store.slug, product.id, 1, { tableLabel: "Bar 1", chargeTo: { kind: "TABLE" } });
    const [tab] = await getOpenPosTabs(fixture.store.slug);

    const moved = await postPosTabToRoom(fixture.store.slug, tab.id, reservation.id);
    expect(moved.success).toBe(true);
    const charges = await prisma.propertyFolioCharge.findMany({ where: { reservationId: reservation.id } });
    expect(charges.reduce((s, c) => s + Number(c.amount), 0)).toBe(3000);
    expect((await prisma.posTab.findUnique({ where: { id: tab.id } }))?.status).toBe("SETTLED");

    // Can't be paid at the table as well.
    expect((await settlePosTab(fixture.store.slug, tab.id, "Cash")).success).toBe(false);
  });
});
