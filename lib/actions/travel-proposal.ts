"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notifications/notify";
import { logError } from "@/lib/observability/log";
import { startTravelCharge } from "@/lib/payments/travel-charge";
import { loadProposal, TOKEN_RE } from "@/lib/travel-proposal";
import type { ActionResult } from "@/types/actions";

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * The client accepts the proposal and its terms from the public link. The record is a typed name, the exact time
 * and the network address, stored with the terms text as it was when the proposal was shared. That is a simple
 * electronic acceptance, not a qualified e-signature. Repeating the call after acceptance changes nothing.
 */
export async function acceptTravelProposal(slug: string, token: string, input: { fullName: string; agree: boolean }): Promise<ActionResult<{ acceptedAt: string }>> {
  if (!TOKEN_RE.test(String(token))) return { success: false, error: "This link isn't valid." };
  const ip = getClientIp(await headers());
  const rl = await checkRateLimit(`travel-accept:${ip}`, 12, 60 * 60 * 1000);
  if (!rl.allowed) return { success: false, error: "Too many attempts. Please try again later." };

  const view = await loadProposal(slug, token);
  if (!view) return { success: false, error: "This proposal is no longer available." };
  if (view.trip.acceptedAt) return { success: true, data: { acceptedAt: view.trip.acceptedAt } };
  if (view.trip.closed) return { success: false, error: "This trip is closed." };
  if (view.trip.expired) return { success: false, error: "This proposal has expired. Please ask the agency for a new one." };
  if (!(view.money.total > 0)) return { success: false, error: "The agency hasn't set a price yet." };
  const fullName = clean(input.fullName, 120);
  if (fullName.length < 3 || !fullName.includes(" ")) return { success: false, error: "Type your full name (first and last) to accept." };
  if (input.agree !== true) return { success: false, error: "Please tick the box to confirm you accept." };

  const at = new Date();
  const res = await prisma.travelTrip.updateMany({
    where: { id: view.trip.id, shareToken: token, acceptedAt: null },
    data: { acceptedAt: at, acceptedName: fullName, acceptedIp: ip.slice(0, 64), ...(view.trip.status === "ENQUIRY" ? { status: "QUOTED" } : {}) },
  });
  if (res.count === 0) {
    const again = await loadProposal(slug, token);
    return again?.trip.acceptedAt ? { success: true, data: { acceptedAt: again.trip.acceptedAt } } : { success: false, error: "Could not record your acceptance. Please try again." };
  }

  try {
    const owner = await prisma.store.findUnique({ where: { id: view.store.id }, select: { business: { select: { userId: true } } } });
    const userId = owner?.business?.userId;
    if (userId) await notifyUser({ userId, type: "TRAVEL_ACCEPTED", title: `Proposal accepted: ${view.trip.title}`, body: `${fullName} accepted the proposal and terms for ${view.trip.title} (${view.trip.reference}).`, url: `/store/${slug}/admin/travel` });
  } catch (err) {
    void logError("API", "Proposal acceptance alert failed", { tripId: view.trip.id, error: err instanceof Error ? err.message : String(err) });
  }
  revalidatePath(`/store/${slug}/admin/travel`);
  return { success: true, data: { acceptedAt: at.toISOString() } };
}

/**
 * Starts a gateway payment from the proposal page. The amount is chosen on the server from the trip's own numbers
 * (deposit, next scheduled instalment or the full balance), never taken from the browser. Needs prior acceptance.
 */
export async function payTravelProposal(slug: string, token: string, option: "deposit" | "next" | "balance"): Promise<ActionResult<{ url: string }>> {
  if (!TOKEN_RE.test(String(token))) return { success: false, error: "This link isn't valid." };
  const ip = getClientIp(await headers());
  const rl = await checkRateLimit(`travel-pay:${ip}`, 15, 60 * 60 * 1000);
  if (!rl.allowed) return { success: false, error: "Too many attempts. Please try again later." };

  const view = await loadProposal(slug, token);
  if (!view) return { success: false, error: "This proposal is no longer available." };
  if (!view.trip.acceptedAt) return { success: false, error: "Please accept the proposal first." };
  if (view.onlineError) return { success: false, error: view.onlineError };
  const chosen = view.payOptions.find((o) => o.id === option);
  if (!chosen) return { success: false, error: "That payment option isn't available right now." };

  const [store, client] = await Promise.all([
    prisma.store.findUnique({ where: { id: view.store.id }, select: { id: true, slug: true, customDomain: true, customDomainStatus: true, paystackSubaccountCode: true, flutterwaveSubaccountId: true } }),
    prisma.travelClient.findFirst({ where: { trips: { some: { id: view.trip.id } } }, select: { fullName: true, email: true } }),
  ]);
  if (!store || !client) return { success: false, error: "This proposal is no longer available." };
  const r = await startTravelCharge({ store, tripId: view.trip.id, amountNaira: chosen.amount, currency: view.trip.currency, email: client.email, customerName: client.fullName });
  return r.success ? { success: true, data: { url: r.url } } : { success: false, error: r.error };
}
