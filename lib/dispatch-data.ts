import { prisma } from "@/lib/prisma";
import { riderCashOwed, statusLabel } from "@/lib/dispatch";

export async function loadDispatchWorkspace(storeId: string) {
  const [riders, deliveries] = await Promise.all([
    prisma.rider.findMany({ where: { storeId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.delivery.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 300, include: { rider: { select: { name: true } } } }),
  ]);
  const cash = riderCashOwed(deliveries.map((d) => ({ riderId: d.riderId, status: d.status, codAmount: Number(d.codAmount), codRemittedAt: d.codRemittedAt })));
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    riders: riders.map((r) => ({ id: r.id, name: r.name, phone: r.phone, vehicle: r.vehicle, active: r.active, accessToken: r.accessToken, cashOwed: cash.get(r.id)?.owed ?? 0, cashJobs: cash.get(r.id)?.jobs ?? 0,
      open: deliveries.filter((d) => d.riderId === r.id && (d.status === "ASSIGNED" || d.status === "PICKED_UP")).length })),
    deliveries: deliveries.map((d) => ({
      id: d.id, jobNo: d.jobNo, status: d.status, statusLabel: statusLabel(d.status), riderId: d.riderId, riderName: d.rider?.name ?? null,
      customerName: d.customerName, customerPhone: d.customerPhone, pickupAddress: d.pickupAddress, dropoffAddress: d.dropoffAddress, itemDescription: d.itemDescription,
      fee: Number(d.fee), feePaid: d.feePaid, codAmount: Number(d.codAmount), codRemittedAt: iso(d.codRemittedAt), failureReason: d.failureReason, trackToken: d.trackToken,
      createdAt: d.createdAt.toISOString(), deliveredAt: iso(d.deliveredAt),
    })),
  };
}
export type DispatchData = Awaited<ReturnType<typeof loadDispatchWorkspace>>;
