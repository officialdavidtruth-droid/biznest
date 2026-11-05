"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notifications/notify";
import { logError } from "@/lib/observability/log";
import { startRentCharge } from "@/lib/payments/rent-charge";
import { rentPortalPath } from "@/lib/real-estate";
import type { ActionResult } from "@/types/actions";

// Public (no sign-in) entry points for tenants. Authorised only by the unit's unguessable portal token; everything is
// rate limited and the amount owed is read from the database, never from the client.

async function callerIp() {
  try { return getClientIp(await headers()); } catch { return "unknown"; }
}

const validToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{20,40}$/.test(t);

async function tenantUnit(slug: string, token: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, customDomain: true, customDomainStatus: true, business: { select: { user: { select: { id: true } } } } } });
  if (!store || store.status !== "ACTIVE") return null;
  const unit = await prisma.realEstateUnit.findUnique({ where: { portalToken: token }, include: { property: { select: { storeId: true, name: true } } } });
  if (!unit || unit.property.storeId !== store.id || !unit.tenantName) return null;
  return { store, unit };
}

/** Tenant taps "Pay now" on one charge. Returns the checkout (or bank-transfer) URL. */
export async function startRentPayment(slug: string, token: string, chargeId: string): Promise<ActionResult<{ url: string }>> {
  if (!validToken(token)) return { success: false, error: "This link isn't valid." };
  const ip = await callerIp();
  const [byIp, byToken] = await Promise.all([
    checkRateLimit(`rent-pay:ip:${ip}`, 20, 60 * 60 * 1000),
    checkRateLimit(`rent-pay:unit:${token}`, 10, 60 * 60 * 1000),
  ]);
  if (!byIp.allowed || !byToken.allowed) return { success: false, error: "Too many attempts. Please try again in a little while." };
  const ctx = await tenantUnit(slug, token);
  if (!ctx) return { success: false, error: "This link isn't valid." };
  const charge = await prisma.rentCharge.findFirst({ where: { id: chargeId, unitId: ctx.unit.id, storeId: ctx.store.id } });
  if (!charge) return { success: false, error: "Charge not found." };
  if (charge.status !== "DUE") return { success: false, error: charge.status === "PAID" ? "This charge is already paid." : "This charge was cancelled." };
  const r = await startRentCharge({ store: ctx.store, chargeId: charge.id, amount: Number(charge.amount), tenantName: ctx.unit.tenantName!, tenantEmail: ctx.unit.tenantEmail });
  if (!r.success) return { success: false, error: r.error };
  return { success: true, data: { url: r.url } };
}

/** Tenant reports a fault from the portal. At most 5 open requests per unit so the form can't be used to flood the landlord. */
export async function submitTenantMaintenance(slug: string, token: string, input: { title: string; detail?: string }): Promise<ActionResult> {
  if (!validToken(token)) return { success: false, error: "This link isn't valid." };
  const ip = await callerIp();
  const [byIp, byToken] = await Promise.all([
    checkRateLimit(`rent-maint:ip:${ip}`, 10, 60 * 60 * 1000),
    checkRateLimit(`rent-maint:unit:${token}`, 5, 60 * 60 * 1000),
  ]);
  if (!byIp.allowed || !byToken.allowed) return { success: false, error: "Too many requests. Please try again later." };
  const ctx = await tenantUnit(slug, token);
  if (!ctx) return { success: false, error: "This link isn't valid." };
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (!title) return { success: false, error: "Describe the problem in a few words." };
  const open = await prisma.maintenanceRequest.count({ where: { unitId: ctx.unit.id, status: { in: ["OPEN", "IN_PROGRESS"] } } });
  if (open >= 5) return { success: false, error: "You already have several open requests. Please wait for the landlord to respond." };
  await prisma.maintenanceRequest.create({ data: { storeId: ctx.store.id, unitId: ctx.unit.id, title, detail: String(input.detail ?? "").trim().slice(0, 1000) || null, reportedBy: "TENANT" } });
  const ownerId = ctx.store.business?.user?.id;
  if (ownerId) {
    try {
      await notifyUser({ userId: ownerId, type: "MAINTENANCE_REQUEST", title: `Repair request: ${ctx.unit.property.name} ${ctx.unit.unitNo}`, body: title, url: `/store/${ctx.store.slug}/admin/real-estate` });
    } catch (err) {
      void logError("API", "Could not notify landlord of repair request", { error: String(err) });
    }
  }
  revalidatePath(`/store/${ctx.store.slug}/admin/real-estate`);
  revalidatePath(rentPortalPath(ctx.store.slug, token));
  return { success: true, data: undefined };
}
