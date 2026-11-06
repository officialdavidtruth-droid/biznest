"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { startMemberCharge } from "@/lib/payments/member-charge";
import { sanitizeGift } from "@/lib/members";
import type { ActionResult } from "@/types/actions";

// Public (no sign-in) entry points. A member is authorised only by their unguessable portal token; gifts need no
// account. Everything is rate limited and amounts owed are read from the database, never trusted from the client.

async function callerIp() {
  try { return getClientIp(await headers()); } catch { return "unknown"; }
}
const validToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{20,40}$/.test(t);
const storeSelect = { id: true, slug: true, name: true, status: true, customDomain: true, customDomainStatus: true } as const;

/** Member taps "Pay now" on one charge of theirs. */
export async function startMemberPayment(slug: string, token: string, chargeId: string): Promise<ActionResult<{ url: string }>> {
  if (!validToken(token)) return { success: false, error: "This link isn't valid." };
  const ip = await callerIp();
  const [byIp, byToken] = await Promise.all([
    checkRateLimit(`member-pay:ip:${ip}`, 20, 60 * 60 * 1000),
    checkRateLimit(`member-pay:tok:${token}`, 10, 60 * 60 * 1000),
  ]);
  if (!byIp.allowed || !byToken.allowed) return { success: false, error: "Too many attempts. Please try again in a little while." };
  const store = await prisma.store.findUnique({ where: { slug }, select: storeSelect });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "This link isn't valid." };
  const member = await prisma.member.findUnique({ where: { portalToken: token } });
  if (!member || member.storeId !== store.id || !member.active) return { success: false, error: "This link isn't valid." };
  const charge = await prisma.memberCharge.findFirst({ where: { id: chargeId, memberId: member.id, storeId: store.id } });
  if (!charge) return { success: false, error: "Charge not found." };
  if (charge.status !== "DUE") return { success: false, error: charge.status === "PAID" ? "This is already paid." : "This was cancelled." };
  const r = await startMemberCharge({ store, chargeId: charge.id, amount: Number(charge.amount), payerName: member.name, payerEmail: member.email });
  if (!r.success) return { success: false, error: r.error };
  return { success: true, data: { url: r.url } };
}

/** A visitor gives from the public giving page. Creates a DUE gift charge and starts checkout. Unpaid gifts are voided by the cron. */
export async function startGiving(slug: string, input: { fund: string; amount: number; name?: string; email?: string }): Promise<ActionResult<{ url: string }>> {
  const ip = await callerIp();
  const byIp = await checkRateLimit(`give:ip:${ip}`, 12, 60 * 60 * 1000);
  if (!byIp.allowed) return { success: false, error: "Too many attempts. Please try again in a little while." };
  const g = sanitizeGift(input);
  if (!g.ok) return { success: false, error: g.error };
  const store = await prisma.store.findUnique({ where: { slug }, select: storeSelect });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "This page isn't available." };
  // Only funds the store actually offers (or the default "General") can be given to.
  const funds = await prisma.memberPlan.findMany({ where: { storeId: store.id, kind: "FUND", active: true }, select: { name: true } });
  const allowed = new Set(["General", ...funds.map((f) => f.name)]);
  if (!allowed.has(g.gift.fund)) return { success: false, error: "Choose one of the listed funds." };
  const charge = await prisma.memberCharge.create({
    data: { storeId: store.id, kind: "GIVING", fund: g.gift.fund, label: g.gift.fund, amount: g.gift.amount, dueDate: new Date(), donorName: g.gift.name, donorEmail: g.gift.email },
    select: { id: true },
  });
  const r = await startMemberCharge({ store, chargeId: charge.id, amount: g.gift.amount, payerName: g.gift.name ?? "Giver", payerEmail: g.gift.email });
  if (!r.success) {
    await prisma.memberCharge.updateMany({ where: { id: charge.id, status: "DUE" }, data: { status: "VOID" } });
    return { success: false, error: r.error };
  }
  return { success: true, data: { url: r.url } };
}
