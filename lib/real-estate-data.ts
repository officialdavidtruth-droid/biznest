import "server-only";
import { prisma } from "@/lib/prisma";
import { summariseCharges } from "@/lib/real-estate";

const num = (v: unknown) => (v == null ? null : Number(v));
const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Everything the landlord workspace shows, as plain JSON (no Decimal or Date objects cross to the client). */
export async function loadRealEstateWorkspace(storeId: string) {
  const [properties, maintenance] = await Promise.all([
    prisma.realEstateProperty.findMany({
      where: { storeId }, orderBy: { createdAt: "desc" }, take: 100,
      include: { units: { orderBy: { unitNo: "asc" }, take: 200, include: { rentCharges: { where: { status: { not: "VOID" } }, orderBy: { dueDate: "asc" }, take: 120 } } } },
    }),
    prisma.maintenanceRequest.findMany({ where: { storeId }, orderBy: [{ createdAt: "desc" }], take: 200, include: { unit: { select: { unitNo: true, property: { select: { name: true } } } } } }),
  ]);
  const now = new Date();
  const allCharges = properties.flatMap((p) => p.units.flatMap((u) => u.rentCharges));
  return {
    summary: summariseCharges(allCharges, now),
    properties: properties.map((p) => ({
      id: p.id, name: p.name, propertyType: p.propertyType, address: p.address,
      units: p.units.map((u) => ({
        id: u.id, unitNo: u.unitNo, status: u.status, rentAmount: num(u.rentAmount), rentCycle: u.rentCycle,
        tenantName: u.tenantName, tenantEmail: u.tenantEmail, tenantPhone: u.tenantPhone,
        leaseStart: iso(u.leaseStart), leaseEnd: iso(u.leaseEnd), portalToken: u.portalToken,
        summary: summariseCharges(u.rentCharges, now),
        charges: u.rentCharges.map((c) => ({ id: c.id, label: c.label, amount: Number(c.amount), status: c.status, dueDate: c.dueDate.toISOString(), paidAt: iso(c.paidAt), method: c.method, receiptNo: c.receiptNo })),
      })),
    })),
    maintenance: maintenance.map((m) => ({
      id: m.id, title: m.title, detail: m.detail, priority: m.priority, status: m.status, reportedBy: m.reportedBy, vendor: m.vendor, cost: num(m.cost),
      createdAt: m.createdAt.toISOString(), unitNo: m.unit.unitNo, propertyName: m.unit.property.name,
    })),
  };
}
export type RealEstateWorkspaceData = Awaited<ReturnType<typeof loadRealEstateWorkspace>>;
