import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  access: vi.fn(), unitFind: vi.fn(), unitUpdate: vi.fn(), chargeFind: vi.fn(), chargeFindMany: vi.fn(), chargeCreate: vi.fn(), chargeCreateMany: vi.fn(), chargeUpdateMany: vi.fn(),
  markPaid: vi.fn(), tx: vi.fn(), maintFind: vi.fn(), maintUpdate: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  realEstateUnit: { findFirst: m.unitFind, update: m.unitUpdate },
  rentCharge: { findFirst: m.chargeFind, findMany: m.chargeFindMany, create: m.chargeCreate, createMany: m.chargeCreateMany, updateMany: m.chargeUpdateMany },
  maintenanceRequest: { findFirst: m.maintFind, update: m.maintUpdate, create: vi.fn() },
  $transaction: (fn: (tx: object) => Promise<unknown>) => fn({}),
} }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: m.access }));
vi.mock("@/lib/payments/rent-receipt", () => ({ markRentChargePaid: m.markPaid }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

import { assignTenant, endTenancy, generateRentSchedule, recordRentPayment, voidRentCharge, updateMaintenanceRequest } from "@/lib/actions/real-estate";

const unit = (over: Record<string, unknown> = {}) => ({ id: "u1", rentAmount: "1200000", rentCycle: "ANNUAL", tenantName: "Ada", leaseEnd: null, portalToken: null, property: { name: "Block A" }, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue({ success: true, store: { id: "s1" } });
  m.unitFind.mockResolvedValue(unit());
  m.chargeFindMany.mockResolvedValue([]);
});

describe("tenancy", () => {
  it("only touches units that belong to the caller's store", async () => {
    m.unitFind.mockResolvedValue(null);
    expect(await assignTenant("shop", "other", { name: "Ada" })).toMatchObject({ success: false, error: "Unit not found." });
    expect(m.unitFind.mock.calls[0][0].where).toMatchObject({ id: "other", property: { storeId: "s1" } });
    expect(m.unitUpdate).not.toHaveBeenCalled();
  });

  it("assigning a tenant opens their portal link and marks the unit occupied", async () => {
    const r = await assignTenant("shop", "u1", { name: "Ada Obi", email: "ada@x.com", leaseStart: "2027-01-01", leaseEnd: "2027-12-31" });
    expect(r.success && r.data.portalToken).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(m.unitUpdate.mock.calls[0][0].data).toMatchObject({ status: "OCCUPIED", tenantName: "Ada Obi", tenantEmail: "ada@x.com" });
  });

  it("keeps the same link when the tenant is edited, and rejects a lease that ends before it starts", async () => {
    m.unitFind.mockResolvedValue(unit({ portalToken: "existing-token-existing-1" }));
    await assignTenant("shop", "u1", { name: "Ada" });
    expect(m.unitUpdate.mock.calls[0][0].data.portalToken).toBe("existing-token-existing-1");
    expect(await assignTenant("shop", "u1", { name: "Ada", leaseStart: "2027-06-01", leaseEnd: "2027-01-01" })).toMatchObject({ success: false });
  });

  it("ending a tenancy kills the link and frees the unit", async () => {
    await endTenancy("shop", "u1");
    expect(m.unitUpdate.mock.calls[0][0].data).toMatchObject({ status: "VACANT", tenantName: null, portalToken: null });
  });
});

describe("rent schedule", () => {
  it("creates one charge per period at the unit's rent, skipping dates already billed", async () => {
    m.unitFind.mockResolvedValue(unit({ rentCycle: "MONTHLY", rentAmount: "100000" }));
    m.chargeFindMany.mockResolvedValue([{ dueDate: new Date("2027-02-01T00:00:00Z") }]);
    const r = await generateRentSchedule("shop", "u1", { startDate: "2027-01-01", periods: 3 });
    expect(r).toMatchObject({ success: true, data: { created: 2, skipped: 1 } });
    const rows = m.chargeCreateMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ storeId: "s1", unitId: "u1", amount: 100000, label: "Rent Jan 2027" });
  });

  it("needs a tenant and a rent amount first", async () => {
    m.unitFind.mockResolvedValue(unit({ tenantName: null }));
    expect(await generateRentSchedule("shop", "u1", { startDate: "2027-01-01", periods: 1 })).toMatchObject({ success: false });
    m.unitFind.mockResolvedValue(unit({ rentAmount: null }));
    expect(await generateRentSchedule("shop", "u1", { startDate: "2027-01-01", periods: 1 })).toMatchObject({ success: false });
    expect(m.chargeCreateMany).not.toHaveBeenCalled();
  });
});

describe("recording and voiding payments", () => {
  it("issues a receipt for a due charge", async () => {
    m.chargeFind.mockResolvedValue({ id: "c1", status: "DUE" });
    m.markPaid.mockResolvedValue("RCT-000005");
    expect(await recordRentPayment("shop", "c1", { method: "CASH" })).toMatchObject({ success: true, data: { receiptNo: "RCT-000005" } });
    expect(m.chargeFind.mock.calls[0][0].where).toMatchObject({ id: "c1", storeId: "s1" });
  });

  it("refuses paid, cancelled, unknown-method and future-dated payments", async () => {
    m.chargeFind.mockResolvedValue({ id: "c1", status: "PAID" });
    expect(await recordRentPayment("shop", "c1", { method: "CASH" })).toMatchObject({ success: false, error: "This charge is already paid." });
    m.chargeFind.mockResolvedValue({ id: "c1", status: "DUE" });
    expect(await recordRentPayment("shop", "c1", { method: "BITCOIN" })).toMatchObject({ success: false });
    expect(await recordRentPayment("shop", "c1", { method: "CASH", paidAt: "2999-01-01" })).toMatchObject({ success: false });
    expect(m.markPaid).not.toHaveBeenCalled();
  });

  it("reports a lost race instead of a false success", async () => {
    m.chargeFind.mockResolvedValue({ id: "c1", status: "DUE" });
    m.markPaid.mockResolvedValue(null);
    expect(await recordRentPayment("shop", "c1", { method: "CASH" })).toMatchObject({ success: false });
  });

  it("only voids unpaid charges in the caller's store", async () => {
    m.chargeUpdateMany.mockResolvedValue({ count: 0 });
    expect(await voidRentCharge("shop", "c1")).toMatchObject({ success: false });
    expect(m.chargeUpdateMany.mock.calls[0][0].where).toMatchObject({ id: "c1", storeId: "s1", status: "DUE" });
  });
});

describe("maintenance", () => {
  it("stamps resolvedAt when fixed and clears it when reopened", async () => {
    m.maintFind.mockResolvedValue({ id: "r1" });
    await updateMaintenanceRequest("shop", "r1", { status: "DONE" });
    expect(m.maintUpdate.mock.calls[0][0].data.resolvedAt).toBeInstanceOf(Date);
    await updateMaintenanceRequest("shop", "r1", { status: "OPEN" });
    expect(m.maintUpdate.mock.calls[1][0].data.resolvedAt).toBeNull();
  });
  it("rejects an unknown status and a negative cost", async () => {
    m.maintFind.mockResolvedValue({ id: "r1" });
    expect(await updateMaintenanceRequest("shop", "r1", { status: "WHATEVER" })).toMatchObject({ success: false });
    expect(await updateMaintenanceRequest("shop", "r1", { cost: -5 })).toMatchObject({ success: false });
  });
});
