"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { formatNumber } from "@/lib/i18n/locale";
import { TRAVEL_PLUGIN_KEY, TRAVEL_BUSINESS_TYPE, tripMoney } from "@/lib/travel";
import { instalmentSchedule, departureDateError } from "@/lib/travel-growth";
import { newShareToken, hashPartnerKey, proposalUrl } from "@/lib/travel-proposal";
import { buildTravelReports } from "@/lib/travel-reports";
import { randomBytes } from "node:crypto";
import type { ActionResult } from "@/types/actions";

async function access(slug: string) {
  const a = await assertStorePermission(slug, `plugin:${TRAVEL_PLUGIN_KEY}`);
  if (!a.success) return a;
  const ent = await getPluginEntitlement(a.store.id, TRAVEL_PLUGIN_KEY);
  if (!ent.allowed) return { success: false as const, error: ent.reason };
  if (!ent.installed) return { success: false as const, error: "Install BizNest Travel from Apps to use this workspace." };
  const type = getCanonicalBusinessType({ businessCategory: a.store.business?.category, storeBusinessType: a.store.businessType });
  if (type !== TRAVEL_BUSINESS_TYPE) return { success: false as const, error: "BizNest Travel is available to travel & tourism businesses." };
  return a;
}

const fail = (error: string): ActionResult<never> => ({ success: false, error });
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const optStr = (v: unknown, max = 200) => str(v, max) || null;
const optDate = (v: unknown) => { if (!v) return null; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? null : d; };
const refresh = (slug: string) => revalidatePath(`/store/${slug}/admin/travel`);
const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

// ---------------------------------------------------------------- settings, partner key

export async function saveTravelSettings(slug: string, input: { termsText?: string; remindersEnabled?: boolean; reviewUrl?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const reviewUrl = optStr(input.reviewUrl, 300);
  if (reviewUrl && !/^https?:\/\/[^\s]+$/i.test(reviewUrl)) return fail("The review link must start with https://");
  const data = { termsText: optStr(input.termsText, 8000), remindersEnabled: input.remindersEnabled !== false, reviewUrl };
  await prisma.travelSettings.upsert({ where: { storeId: a.store.id }, create: { storeId: a.store.id, ...data }, update: data });
  refresh(slug); return { success: true, data: undefined };
}

/** Creates (or replaces) the partner API key. The key is shown once; only its hash is stored. */
export async function rotateTravelPartnerKey(slug: string): Promise<ActionResult<{ key: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const key = `tpk_${randomBytes(24).toString("base64url")}`;
  const data = { partnerKeyHash: hashPartnerKey(key), partnerKeyHint: key.slice(-4) };
  await prisma.travelSettings.upsert({ where: { storeId: a.store.id }, create: { storeId: a.store.id, ...data }, update: data });
  refresh(slug); return { success: true, data: { key } };
}

export async function revokeTravelPartnerKey(slug: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  await prisma.travelSettings.updateMany({ where: { storeId: a.store.id }, data: { partnerKeyHash: null, partnerKeyHint: null } });
  refresh(slug); return { success: true, data: undefined };
}

// ---------------------------------------------------------------- departures

export async function saveTravelDeparture(slug: string, input: { id?: string; packageId: string; departureDate: string; seats?: number; cutoffDays?: number; pricePerPerson?: number | string; isActive?: boolean }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const pkg = await prisma.travelPackage.findFirst({ where: { id: input.packageId, storeId: a.store.id }, select: { id: true, departureDate: true } });
  if (!pkg) return fail("Package not found.");
  const date = optDate(input.departureDate);
  const others = await prisma.travelDeparture.findMany({ where: { packageId: pkg.id, ...(input.id ? { id: { not: input.id } } : {}) }, select: { departureDate: true } });
  const existing = [...others.map((o) => o.departureDate), ...(pkg.departureDate ? [pkg.departureDate] : [])];
  const err = departureDateError(date, existing);
  if (err) return fail(err);
  const seats = Math.max(0, Math.min(5000, Math.floor(Number(input.seats) || 0)));
  const cutoffDays = Math.max(0, Math.min(365, Math.floor(Number(input.cutoffDays) || 0)));
  const rawPrice = input.pricePerPerson === undefined || input.pricePerPerson === null || input.pricePerPerson === "" ? null : Number(input.pricePerPerson);
  if (rawPrice !== null && (!Number.isFinite(rawPrice) || rawPrice <= 0)) return fail("Enter a valid price, or leave it empty to use the package price.");
  const data = { departureDate: date!, seats, cutoffDays, pricePerPerson: rawPrice === null ? null : Math.round(rawPrice * 100) / 100, isActive: input.isActive !== false };
  if (input.id) {
    if (seats > 0) {
      const held = await prisma.travelTraveler.count({ where: { trip: { departureId: input.id, status: { in: ["CONFIRMED", "TICKETED", "TRAVELLING", "COMPLETED"] } } } });
      if (held > seats) return fail(`${held} seat(s) are already held on this departure; the limit can't be lower than that.`);
    }
    const res = await prisma.travelDeparture.updateMany({ where: { id: input.id, packageId: pkg.id, storeId: a.store.id }, data });
    if (!res.count) return fail("Departure not found.");
  } else {
    await prisma.travelDeparture.create({ data: { ...data, storeId: a.store.id, packageId: pkg.id } });
  }
  refresh(slug); return { success: true, data: undefined };
}

/** Deletes a departure nobody has booked; one with trips on it is closed instead, so the history stays intact. */
export async function removeTravelDeparture(slug: string, departureId: string): Promise<ActionResult<{ closed: boolean }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const dep = await prisma.travelDeparture.findFirst({ where: { id: departureId, storeId: a.store.id }, select: { id: true, _count: { select: { trips: true } } } });
  if (!dep) return fail("Departure not found.");
  if (dep._count.trips > 0) { await prisma.travelDeparture.update({ where: { id: dep.id }, data: { isActive: false } }); refresh(slug); return { success: true, data: { closed: true } }; }
  await prisma.travelDeparture.delete({ where: { id: dep.id } });
  refresh(slug); return { success: true, data: { closed: false } };
}

// ---------------------------------------------------------------- proposals

async function ownTripForShare(storeId: string, tripId: string) {
  return prisma.travelTrip.findFirst({
    where: { id: tripId, storeId },
    include: { client: true, store: { select: { id: true, slug: true, name: true, logoUrl: true, themeColors: true, contactEmail: true, contactPhone: true, customDomain: true, customDomainStatus: true } } },
  });
}

/** Creates the public proposal link for a trip (or refreshes its note, expiry and terms). The link keeps the same address. */
export async function shareTravelProposal(slug: string, tripId: string, input: { note?: string; validUntil?: string; terms?: string }): Promise<ActionResult<{ url: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await ownTripForShare(a.store.id, tripId);
  if (!trip) return fail("Trip not found.");
  if (["CANCELLED", "COMPLETED"].includes(trip.status)) return fail("This trip is closed.");
  if (!(Number(trip.totalPrice) > 0)) return fail("Set a price (or add priced services) before sharing a proposal.");
  const validUntil = optDate(input.validUntil);
  if (input.validUntil && !validUntil) return fail("Enter a valid expiry date.");
  if (validUntil && validUntil.getTime() < Date.now() - 86_400_000) return fail("The expiry date is in the past.");
  if (trip.acceptedAt && (input.terms !== undefined && optStr(input.terms, 8000) !== trip.termsText)) return fail("The client has already accepted these terms, so they can't be changed. Create a new trip for different terms.");
  const settings = await prisma.travelSettings.findUnique({ where: { storeId: a.store.id }, select: { termsText: true } });
  const terms = trip.acceptedAt ? trip.termsText : optStr(input.terms, 8000) ?? trip.termsText ?? settings?.termsText ?? null;
  const token = trip.shareToken ?? newShareToken();
  await prisma.travelTrip.update({
    where: { id: trip.id },
    data: { shareToken: token, proposalNote: optStr(input.note, 2000), proposalValidUntil: validUntil, termsText: terms, proposalSentAt: trip.proposalSentAt ?? new Date(), ...(trip.status === "ENQUIRY" ? { status: "QUOTED" } : {}) },
  });
  refresh(slug); return { success: true, data: { url: proposalUrl(trip.store, token) } };
}

/** Turns the public link off. The acceptance record stays on the trip. */
export async function unshareTravelProposal(slug: string, tripId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const res = await prisma.travelTrip.updateMany({ where: { id: tripId, storeId: a.store.id }, data: { shareToken: null } });
  if (!res.count) return fail("Trip not found.");
  refresh(slug); return { success: true, data: undefined };
}

export async function emailTravelProposal(slug: string, tripId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await ownTripForShare(a.store.id, tripId);
  if (!trip) return fail("Trip not found.");
  if (!trip.shareToken) return fail("Create the proposal link first.");
  const to = trip.client.email?.trim();
  if (!to) return fail("This client has no email address. Copy the link and send it by WhatsApp instead.");
  const url = proposalUrl(trip.store, trip.shareToken);
  const m = tripMoney(trip, await prisma.travelPayment.findMany({ where: { tripId: trip.id }, select: { amount: true, status: true, refundedAmount: true } }));
  const expiry = trip.proposalValidUntil ? `This proposal is valid until ${trip.proposalValidUntil.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.` : "";
  const html = [
    `Hi ${esc(trip.client.fullName.split(" ")[0] || "there")},`,
    trip.proposalNote ? esc(trip.proposalNote).replace(/\n/g, "<br/>") : `Here is your proposal for <strong>${esc(trip.title)}</strong> (${esc(trip.destination)}).`,
    `<strong>Total:</strong> ${esc(trip.currency)} ${formatNumber(m.total)}`,
    `<a href="${esc(url)}">View your proposal, accept it and pay online</a>`,
    expiry,
  ].filter(Boolean).join("<br/><br/>");
  try {
    const sent = await sendOrderNotificationEmail(to, `Your trip proposal: ${trip.title}`, html, storeEmailBrand(trip.store));
    if (sent?.error) throw new Error(sent.error.message);
  } catch { return fail("The email could not be sent. Copy the link and send it yourself."); }
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------- instalment plans

/**
 * Replaces the trip's unpaid scheduled instalments with a fresh plan covering the outstanding balance.
 * Instalments already paid are never touched. Reminders and the client's "pay next instalment" button follow the plan.
 */
export async function createTravelInstalmentPlan(slug: string, tripId: string, input: { count: number; firstDue: string; intervalDays: number }): Promise<ActionResult<{ created: number }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, storeId: a.store.id }, include: { payments: true } });
  if (!trip) return fail("Trip not found.");
  if (["CANCELLED", "COMPLETED"].includes(trip.status)) return fail("This trip is closed.");
  const m = tripMoney(trip, trip.payments);
  if (!(m.total > 0)) return fail("Set a price first.");
  if (!(m.balance > 0)) return fail("There is no outstanding balance to schedule.");
  const firstDue = optDate(input.firstDue);
  if (!firstDue) return fail("Choose the date of the first instalment.");
  if (firstDue.getTime() < Date.now() - 86_400_000) return fail("The first instalment can't be in the past.");
  const plan = instalmentSchedule({ balance: m.balance, count: Number(input.count), firstDue, intervalDays: Number(input.intervalDays) });
  if (!plan.length) return fail("Choose between 1 and 24 instalments, 1 to 365 days apart.");
  if (trip.departDate && plan[plan.length - 1].dueDate.getTime() > trip.departDate.getTime()) return fail("The last instalment would fall after the departure date. Use fewer instalments or a shorter gap.");
  await prisma.$transaction([
    prisma.travelPayment.updateMany({ where: { tripId: trip.id, status: "DUE" }, data: { status: "VOID", note: "Replaced by a new instalment plan" } }),
    ...plan.map((p, i) => prisma.travelPayment.create({ data: { tripId: trip.id, amount: p.amount, method: "TRANSFER", status: "DUE", dueDate: p.dueDate, note: `Instalment ${i + 1} of ${plan.length}` } })),
  ]);
  refresh(slug); return { success: true, data: { created: plan.length } };
}

export async function clearTravelInstalmentPlan(slug: string, tripId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, storeId: a.store.id }, select: { id: true } });
  if (!trip) return fail("Trip not found.");
  await prisma.travelPayment.updateMany({ where: { tripId: trip.id, status: "DUE" }, data: { status: "VOID", note: "Instalment plan removed" } });
  refresh(slug); return { success: true, data: undefined };
}

// ---------------------------------------------------------------- reports

export async function getTravelReports(slug: string) {
  const a = await access(slug);
  if (!a.success) return null;
  return buildTravelReports(a.store.id);
}
