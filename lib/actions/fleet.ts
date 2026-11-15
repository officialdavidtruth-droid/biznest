"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import type { ActionResult } from "@/types/actions";

const LOG_TYPES = ["FUEL", "SERVICE", "REPAIR", "INSURANCE", "OTHER"] as const;
const STATUSES = ["ACTIVE", "IN_SERVICE", "RETIRED"] as const;

async function fleetAccess(slug: string) {
  const a = await assertStorePermission(slug, "plugin:fleet-management");
  if (!a.success) return a;
  const entitlement = await getPluginEntitlement(a.store.id, "fleet-management");
  if (!entitlement.allowed) return { success: false as const, error: entitlement.reason };
  if (!entitlement.installed) return { success: false as const, error: "Install Fleet Management from Apps first." };
  return a;
}

export type VehicleInput = {
  registration: string; name?: string; make?: string; model?: string; year?: number; driverName?: string;
  status?: string; odometer?: number; nextServiceKm?: number | null; nextServiceDate?: string | null; insuranceExpiry?: string | null; notes?: string;
};

export type FleetVehicleView = {
  id: string; registration: string; name: string | null; make: string | null; model: string | null; year: number | null; driverName: string | null;
  status: string; odometer: number; nextServiceKm: number | null; nextServiceDate: string | null; insuranceExpiry: string | null; notes: string | null;
  cost30: number; costTotal: number; kmPerLitre: number | null; lastLogAt: string | null;
};
export type FleetLogView = { id: string; vehicleId: string; registration: string; type: string; loggedAt: string; odometer: number | null; litres: number | null; cost: number; notes: string | null };

/** Cost-per-km and km/litre need two odometer readings; both come from the logs. */
export async function getFleetWorkspace(slug: string): Promise<{ error: string } | { vehicles: FleetVehicleView[]; logs: FleetLogView[]; fuel30: number; cost30: number; costPerKm: number | null }> {
  const a = await fleetAccess(slug);
  if (!a.success) return { error: a.error };
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [vehicles, logs] = await Promise.all([
    prisma.fleetVehicle.findMany({ where: { storeId: a.store.id }, orderBy: [{ status: "asc" }, { registration: "asc" }] }),
    prisma.fleetLog.findMany({ where: { storeId: a.store.id }, orderBy: { loggedAt: "desc" }, take: 500, include: { vehicle: { select: { registration: true } } } }),
  ]);

  const views: FleetVehicleView[] = vehicles.map((v) => {
    const mine = logs.filter((l) => l.vehicleId === v.id);
    const fuel = mine.filter((l) => l.type === "FUEL" && l.litres != null && l.odometer != null).sort((x, y) => (x.odometer ?? 0) - (y.odometer ?? 0));
    let kmPerLitre: number | null = null;
    if (fuel.length >= 2) {
      const km = (fuel[fuel.length - 1].odometer ?? 0) - (fuel[0].odometer ?? 0);
      // Fuel bought at the first reading fills the tank for the trip before it, so it is excluded.
      const litres = fuel.slice(1).reduce((n, l) => n + Number(l.litres), 0);
      if (km > 0 && litres > 0) kmPerLitre = Math.round((km / litres) * 10) / 10;
    }
    return {
      id: v.id, registration: v.registration, name: v.name, make: v.make, model: v.model, year: v.year, driverName: v.driverName, status: v.status, odometer: v.odometer,
      nextServiceKm: v.nextServiceKm, nextServiceDate: v.nextServiceDate?.toISOString() ?? null, insuranceExpiry: v.insuranceExpiry?.toISOString() ?? null, notes: v.notes,
      cost30: mine.filter((l) => l.loggedAt >= since).reduce((n, l) => n + Number(l.cost), 0),
      costTotal: mine.reduce((n, l) => n + Number(l.cost), 0), kmPerLitre, lastLogAt: mine[0]?.loggedAt.toISOString() ?? null,
    };
  });

  const recent = logs.filter((l) => l.loggedAt >= since);
  const km30 = vehicles.reduce((n, v) => {
    const odo = logs.filter((l) => l.vehicleId === v.id && l.odometer != null && l.loggedAt >= since).map((l) => l.odometer as number);
    return odo.length >= 2 ? n + (Math.max(...odo) - Math.min(...odo)) : n;
  }, 0);
  const cost30 = recent.reduce((n, l) => n + Number(l.cost), 0);

  return {
    vehicles: views,
    logs: logs.slice(0, 100).map((l) => ({ id: l.id, vehicleId: l.vehicleId, registration: l.vehicle.registration, type: l.type, loggedAt: l.loggedAt.toISOString(), odometer: l.odometer, litres: l.litres == null ? null : Number(l.litres), cost: Number(l.cost), notes: l.notes })),
    fuel30: recent.filter((l) => l.type === "FUEL").reduce((n, l) => n + Number(l.cost), 0),
    cost30,
    costPerKm: km30 > 0 ? Math.round((cost30 / km30) * 100) / 100 : null,
  };
}

function clean(input: VehicleInput) {
  return {
    registration: input.registration.trim().toUpperCase(),
    name: input.name?.trim() || null, make: input.make?.trim() || null, model: input.model?.trim() || null,
    year: input.year && Number.isInteger(input.year) ? input.year : null, driverName: input.driverName?.trim() || null,
    status: STATUSES.includes(input.status as any) ? input.status! : "ACTIVE",
    odometer: Math.max(0, Math.round(input.odometer ?? 0)),
    nextServiceKm: input.nextServiceKm && input.nextServiceKm > 0 ? Math.round(input.nextServiceKm) : null,
    nextServiceDate: input.nextServiceDate ? new Date(input.nextServiceDate) : null,
    insuranceExpiry: input.insuranceExpiry ? new Date(input.insuranceExpiry) : null,
    notes: input.notes?.trim() || null,
  };
}

export async function saveFleetVehicle(slug: string, input: VehicleInput, vehicleId?: string): Promise<ActionResult<{ id: string }>> {
  const a = await fleetAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  const data = clean(input);
  if (!data.registration) return { success: false, error: "Enter the registration number." };
  try {
    if (vehicleId) {
      const found = await prisma.fleetVehicle.findFirst({ where: { id: vehicleId, storeId: a.store.id }, select: { id: true } });
      if (!found) return { success: false, error: "Vehicle not found." };
      await prisma.fleetVehicle.update({ where: { id: vehicleId }, data });
      revalidatePath(`/store/${slug}/admin/apps/fleet-management`);
      return { success: true, data: { id: vehicleId } };
    }
    const v = await prisma.fleetVehicle.create({ data: { ...data, storeId: a.store.id } });
    revalidatePath(`/store/${slug}/admin/apps/fleet-management`);
    return { success: true, data: { id: v.id } };
  } catch (e: any) {
    if (e?.code === "P2002") return { success: false, error: "A vehicle with this registration already exists." };
    return { success: false, error: "Could not save the vehicle." };
  }
}

export async function deleteFleetVehicle(slug: string, vehicleId: string): Promise<ActionResult> {
  const a = await fleetAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  const r = await prisma.fleetVehicle.deleteMany({ where: { id: vehicleId, storeId: a.store.id } });
  if (r.count === 0) return { success: false, error: "Vehicle not found." };
  revalidatePath(`/store/${slug}/admin/apps/fleet-management`);
  return { success: true, data: undefined };
}

export async function addFleetLog(slug: string, input: { vehicleId: string; type: string; loggedAt?: string; odometer?: number; litres?: number; cost?: number; notes?: string }): Promise<ActionResult> {
  const a = await fleetAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  if (!LOG_TYPES.includes(input.type as any)) return { success: false, error: "Choose what you are logging." };
  const v = await prisma.fleetVehicle.findFirst({ where: { id: input.vehicleId, storeId: a.store.id } });
  if (!v) return { success: false, error: "Vehicle not found." };
  const cost = input.cost ?? 0;
  if (cost < 0 || (input.litres != null && input.litres < 0)) return { success: false, error: "Amounts cannot be negative." };
  if (input.type === "FUEL" && !(input.litres && input.litres > 0)) return { success: false, error: "Enter the litres for a fuel log." };
  const odometer = input.odometer != null && input.odometer > 0 ? Math.round(input.odometer) : null;
  const session = await auth();
  await prisma.$transaction(async (tx) => {
    await tx.fleetLog.create({ data: { storeId: a.store.id, vehicleId: v.id, type: input.type, loggedAt: input.loggedAt ? new Date(input.loggedAt) : new Date(), odometer, litres: input.litres ?? null, cost, notes: input.notes?.trim() || null, createdBy: session?.user?.id ?? null } });
    const patch: Record<string, unknown> = {};
    if (odometer != null && odometer > v.odometer) patch.odometer = odometer;
    // Logging a service resets the reminder window to what the owner set: they re-enter the next due values.
    if (Object.keys(patch).length) await tx.fleetVehicle.update({ where: { id: v.id }, data: patch });
  });
  revalidatePath(`/store/${slug}/admin/apps/fleet-management`);
  return { success: true, data: undefined };
}

export async function deleteFleetLog(slug: string, logId: string): Promise<ActionResult> {
  const a = await fleetAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  const r = await prisma.fleetLog.deleteMany({ where: { id: logId, storeId: a.store.id } });
  if (r.count === 0) return { success: false, error: "Entry not found." };
  revalidatePath(`/store/${slug}/admin/apps/fleet-management`);
  return { success: true, data: undefined };
}
