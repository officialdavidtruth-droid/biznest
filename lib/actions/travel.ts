"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import type { ActionResult } from "@/types/actions";
import { startTravelCharge } from "@/lib/payments/travel-charge";
import {
  TRAVEL_PLUGIN_KEY, TRAVEL_BUSINESS_TYPE, TRIP_STATUSES, ITEM_KINDS, ITEM_STATUSES, PAYMENT_METHODS,
  SUPPLIER_KINDS, SEAT_HOLDING_STATUSES, VISA_STATUSES, VISA_TYPES, DEFAULT_VISA_CHECKLIST, canPayOnline, canMoveTrip, newTripReference, tripMoney,
  type TripStatus,
} from "@/lib/travel";

type Access = Awaited<ReturnType<typeof access>>;

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

function fail(error: string): ActionResult<never> { return { success: false, error }; }
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const optStr = (v: unknown, max = 200) => { const s = str(v, max); return s || null; };
const money = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN; };
const optDate = (v: unknown) => { if (!v) return null; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? null : d; };
const oneOf = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] => (list as readonly string[]).includes(String(v)) ? (String(v) as T[number]) : fallback;
const refresh = (slug: string) => revalidatePath(`/store/${slug}/admin/travel`);

/** Recompute a trip's selling price/cost from its non-cancelled service lines (when it has any). */
async function recalcTrip(tripId: string) {
  const items = await prisma.travelTripItem.findMany({ where: { tripId, status: { not: "CANCELLED" } }, select: { costPrice: true, sellPrice: true } });
  if (!items.length) return;
  const totalPrice = items.reduce((s, i) => s + Number(i.sellPrice), 0);
  const totalCost = items.reduce((s, i) => s + Number(i.costPrice), 0);
  await prisma.travelTrip.update({ where: { id: tripId }, data: { totalPrice, totalCost } });
}

/** Travellers holding seats on a package (committed trips only), optionally ignoring one trip. */
async function seatsTaken(packageId: string, excludeTripId?: string) {
  return prisma.travelTraveler.count({ where: { trip: { packageId, status: { in: [...SEAT_HOLDING_STATUSES] }, ...(excludeTripId ? { id: { not: excludeTripId } } : {}) } } });
}

async function ownTrip(a: Extract<Access, { success: true }>, tripId: string) {
  return prisma.travelTrip.findFirst({ where: { id: tripId, storeId: a.store.id }, select: { id: true, status: true, totalPrice: true, totalCost: true } });
}

// ---------------------------------------------------------------- dashboard

export async function getTravelDashboard(slug: string) {
  const a = await access(slug);
  if (!a.success) return null;
  const storeId = a.store.id;
  const now = new Date();
  const [trips, clients, suppliers, packages, visas] = await Promise.all([
    prisma.travelTrip.findMany({
      where: { storeId }, orderBy: { createdAt: "desc" }, take: 300,
      include: { client: { select: { id: true, fullName: true, phone: true, email: true } }, travellers: true, items: { orderBy: { createdAt: "asc" }, include: { supplier: { select: { name: true } } } }, payments: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.travelClient.findMany({ where: { storeId }, orderBy: { fullName: "asc" }, take: 500, include: { _count: { select: { trips: true } } } }),
    prisma.travelSupplier.findMany({ where: { storeId, isArchived: false }, orderBy: { name: "asc" }, take: 200 }),
    prisma.travelPackage.findMany({ where: { storeId }, orderBy: [{ isActive: "desc" }, { departureDate: "asc" }], take: 100, include: { trips: { select: { status: true, travellers: { select: { id: true } } } } } }),
    prisma.travelVisaCase.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 200, include: { client: { select: { fullName: true } } } }),
  ]);

  const serialTrips = trips.map((t) => {
    const m = tripMoney(t, t.payments);
    return {
      id: t.id, reference: t.reference, title: t.title, destination: t.destination, status: t.status as TripStatus,
      departDate: t.departDate?.toISOString() ?? null, returnDate: t.returnDate?.toISOString() ?? null,
      currency: t.currency, notes: t.notes, packageId: t.packageId, createdAt: t.createdAt.toISOString(),
      client: t.client, money: m,
      travellers: t.travellers.map((x) => ({ id: x.id, fullName: x.fullName, passportNo: x.passportNo, passportExpiry: x.passportExpiry?.toISOString() ?? null, nationality: x.nationality, isLead: x.isLead })),
      items: t.items.map((i) => ({ id: i.id, kind: i.kind, description: i.description, status: i.status, confirmationRef: i.confirmationRef, startDate: i.startDate?.toISOString() ?? null, supplierId: i.supplierId, supplierName: i.supplier?.name ?? null, costPrice: Number(i.costPrice), sellPrice: Number(i.sellPrice) })),
      payments: t.payments.map((p) => ({ id: p.id, amount: Number(p.amount), method: p.method, status: p.status, dueDate: p.dueDate?.toISOString() ?? null, paidAt: p.paidAt?.toISOString() ?? null, reference: p.reference, note: p.note })),
    };
  });

  const open = serialTrips.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status));
  const overduePayments = serialTrips.flatMap((t) => t.payments.filter((p) => p.status === "DUE" && p.dueDate && new Date(p.dueDate) < now).map((p) => ({ ...p, tripId: t.id, reference: t.reference, client: t.client.fullName, currency: t.currency })));
  const stats = {
    openTrips: open.length,
    enquiries: serialTrips.filter((t) => t.status === "ENQUIRY" || t.status === "QUOTED").length,
    departingSoon: open.filter((t) => t.departDate && new Date(t.departDate) >= now && new Date(t.departDate).getTime() - now.getTime() <= 14 * 86_400_000).length,
    outstanding: open.reduce((s, t) => s + (["CONFIRMED", "TICKETED", "TRAVELLING"].includes(t.status) ? t.money.balance : 0), 0),
    revenue: serialTrips.filter((t) => !["ENQUIRY", "QUOTED", "CANCELLED"].includes(t.status)).reduce((s, t) => s + t.money.total, 0),
    margin: serialTrips.filter((t) => !["ENQUIRY", "QUOTED", "CANCELLED"].includes(t.status)).reduce((s, t) => s + t.money.margin, 0),
    openVisas: visas.filter((v) => !["APPROVED", "REFUSED"].includes(v.status)).length,
  };

  return {
    currency: a.store.currency || "NGN", locale: a.store.locale ?? null, stats, overduePayments,
    trips: serialTrips,
    clients: clients.map((c) => ({ id: c.id, fullName: c.fullName, email: c.email, phone: c.phone, nationality: c.nationality, passportNo: c.passportNo, passportExpiry: c.passportExpiry?.toISOString() ?? null, notes: c.notes, tripCount: c._count.trips })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, kind: s.kind, contactName: s.contactName, email: s.email, phone: s.phone })),
    packages: packages.map((p) => ({ id: p.id, name: p.name, destination: p.destination, durationDays: p.durationDays, pricePerPerson: Number(p.pricePerPerson), currency: p.currency, departureDate: p.departureDate?.toISOString() ?? null, seats: p.seats, depositPercent: p.depositPercent, booked: p.trips.filter((t) => (SEAT_HOLDING_STATUSES as readonly string[]).includes(t.status)).reduce((s, t) => s + t.travellers.length, 0), inclusions: p.inclusions, isActive: p.isActive })),
    visas: visas.map((v) => ({ id: v.id, clientName: v.client.fullName, clientId: v.clientId, country: v.country, visaType: v.visaType, status: v.status, checklist: (Array.isArray(v.checklist) ? v.checklist : []) as { label: string; done: boolean }[], appointmentAt: v.appointmentAt?.toISOString() ?? null, fee: Number(v.fee), notes: v.notes })),
  };
}

// ---------------------------------------------------------------- clients

export async function saveTravelClient(slug: string, input: { id?: string; fullName: string; email?: string; phone?: string; nationality?: string; passportNo?: string; passportExpiry?: string; dateOfBirth?: string; notes?: string }): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const fullName = str(input.fullName, 120);
  if (fullName.length < 2) return fail("Enter the client's full name.");
  const email = optStr(input.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
  const data = { fullName, email, phone: optStr(input.phone, 40), nationality: optStr(input.nationality, 60), passportNo: optStr(input.passportNo, 30)?.toUpperCase() ?? null, passportExpiry: optDate(input.passportExpiry), dateOfBirth: optDate(input.dateOfBirth), notes: optStr(input.notes, 2000) };
  if (input.id) {
    const own = await prisma.travelClient.findFirst({ where: { id: input.id, storeId: a.store.id }, select: { id: true } });
    if (!own) return fail("Client not found.");
    await prisma.travelClient.update({ where: { id: own.id }, data });
    refresh(slug); return { success: true, data: { id: own.id } };
  }
  const created = await prisma.travelClient.create({ data: { ...data, storeId: a.store.id }, select: { id: true } });
  refresh(slug); return { success: true, data: created };
}

// ---------------------------------------------------------------- trips

export async function createTravelTrip(slug: string, input: { clientId: string; title: string; destination: string; departDate?: string; returnDate?: string; packageId?: string; travellerCount?: number; totalPrice?: number; notes?: string }): Promise<ActionResult<{ id: string; reference: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const client = await prisma.travelClient.findFirst({ where: { id: input.clientId, storeId: a.store.id } });
  if (!client) return fail("Choose a client for this trip.");
  const destination = str(input.destination, 120);
  const title = str(input.title, 160) || (destination ? `${destination} trip` : "");
  if (!destination) return fail("Enter a destination.");
  const departDate = optDate(input.departDate), returnDate = optDate(input.returnDate);
  if (departDate && returnDate && returnDate < departDate) return fail("The return date can't be before the departure date.");
  let totalPrice = input.totalPrice === undefined || input.totalPrice === null || (input.totalPrice as unknown) === "" ? 0 : money(input.totalPrice);
  if (Number.isNaN(totalPrice)) return fail("Enter a valid price.");
  const count = Math.max(1, Math.min(60, Math.floor(Number(input.travellerCount) || 1)));
  let packageId: string | null = null;
  let currency = a.store.currency || "NGN";
  let finalDepart = departDate, finalReturn = returnDate;
  if (input.packageId) {
    const pkg = await prisma.travelPackage.findFirst({ where: { id: input.packageId, storeId: a.store.id, isActive: true }, });
    if (!pkg) return fail("That package is no longer available.");
    if (pkg.seats > 0) {
      const taken = await seatsTaken(pkg.id);
      if (taken + count > pkg.seats) return fail(`Only ${Math.max(0, pkg.seats - taken)} seat(s) left on this package.`);
    }
    packageId = pkg.id; currency = pkg.currency;
    if (!totalPrice) totalPrice = Number(pkg.pricePerPerson) * count;
    if (!finalDepart && pkg.departureDate) { finalDepart = pkg.departureDate; finalReturn = finalReturn ?? new Date(pkg.departureDate.getTime() + (pkg.durationDays - 1) * 86_400_000); }
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const trip = await prisma.travelTrip.create({
        data: {
          storeId: a.store.id, reference: newTripReference(new Date(), attempt), clientId: client.id, packageId, title, destination, departDate: finalDepart, returnDate: finalReturn, currency, totalPrice, notes: optStr(input.notes, 2000),
          travellers: { create: Array.from({ length: count }, (_, i) => ({ fullName: i === 0 ? client.fullName : `Traveller ${i + 1}`, isLead: i === 0, passportNo: i === 0 ? client.passportNo : null, passportExpiry: i === 0 ? client.passportExpiry : null, nationality: i === 0 ? client.nationality : null })) },
        },
        select: { id: true, reference: true },
      });
      refresh(slug); return { success: true, data: trip };
    } catch (e: any) { if (e?.code !== "P2002") throw e; }
  }
  return fail("Could not generate a unique trip reference. Please try again.");
}

export async function updateTravelTrip(slug: string, tripId: string, input: { title?: string; destination?: string; departDate?: string | null; returnDate?: string | null; totalPrice?: number; notes?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await ownTrip(a, tripId); if (!trip) return fail("Trip not found.");
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) { const t = str(input.title, 160); if (!t) return fail("Title can't be empty."); data.title = t; }
  if (input.destination !== undefined) { const d = str(input.destination, 120); if (!d) return fail("Destination can't be empty."); data.destination = d; }
  if (input.departDate !== undefined) data.departDate = optDate(input.departDate);
  if (input.returnDate !== undefined) data.returnDate = optDate(input.returnDate);
  if (data.departDate && data.returnDate && (data.returnDate as Date) < (data.departDate as Date)) return fail("The return date can't be before the departure date.");
  if (input.notes !== undefined) data.notes = optStr(input.notes, 2000);
  if (input.totalPrice !== undefined) { const p = money(input.totalPrice); if (Number.isNaN(p)) return fail("Enter a valid price."); data.totalPrice = p; }
  await prisma.travelTrip.update({ where: { id: trip.id }, data });
  refresh(slug); return { success: true, data: undefined };
}

export async function setTravelTripStatus(slug: string, tripId: string, status: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  if (!(TRIP_STATUSES as readonly string[]).includes(status)) return fail("Unknown status.");
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, storeId: a.store.id }, include: { payments: true, travellers: true } });
  if (!trip) return fail("Trip not found.");
  if (!canMoveTrip(trip.status as TripStatus, status as TripStatus)) return fail(trip.status === "CANCELLED" || trip.status === "COMPLETED" ? `A ${trip.status.toLowerCase()} trip can't be changed.` : "That status change isn't allowed.");
  if (["CONFIRMED", "TICKETED", "TRAVELLING"].includes(status) && Number(trip.totalPrice) <= 0) return fail("Set a price before confirming this trip.");
  if ((SEAT_HOLDING_STATUSES as readonly string[]).includes(status) && trip.packageId && !(SEAT_HOLDING_STATUSES as readonly string[]).includes(trip.status)) {
    const pkg = await prisma.travelPackage.findUnique({ where: { id: trip.packageId }, select: { seats: true, name: true } });
    if (pkg && pkg.seats > 0) {
      const left = pkg.seats - (await seatsTaken(trip.packageId, trip.id));
      if (trip.travellers.length > left) return fail(`Only ${Math.max(0, left)} seat(s) left on ${pkg.name}; this trip has ${trip.travellers.length} traveller(s).`);
    }
  }
  if (status === "TICKETED" && tripMoney(trip, trip.payments).paid <= 0) return fail("Record at least a deposit before ticketing.");
  if (status === "COMPLETED" && tripMoney(trip, trip.payments).balance > 0) return fail("There is still an outstanding balance. Record the payment before completing the trip.");
  await prisma.travelTrip.update({ where: { id: trip.id }, data: { status } });
  refresh(slug); return { success: true, data: undefined };
}

export async function saveTravelTraveler(slug: string, tripId: string, input: { id?: string; fullName: string; passportNo?: string; passportExpiry?: string; dateOfBirth?: string; nationality?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await ownTrip(a, tripId); if (!trip) return fail("Trip not found.");
  const fullName = str(input.fullName, 120); if (fullName.length < 2) return fail("Enter the traveller's name.");
  const data = { fullName, passportNo: optStr(input.passportNo, 30)?.toUpperCase() ?? null, passportExpiry: optDate(input.passportExpiry), dateOfBirth: optDate(input.dateOfBirth), nationality: optStr(input.nationality, 60) };
  if (input.id) {
    const t = await prisma.travelTraveler.findFirst({ where: { id: input.id, tripId: trip.id } });
    if (!t) return fail("Traveller not found.");
    await prisma.travelTraveler.update({ where: { id: t.id }, data });
  } else {
    await prisma.travelTraveler.create({ data: { ...data, tripId: trip.id } });
  }
  refresh(slug); return { success: true, data: undefined };
}

export async function removeTravelTraveler(slug: string, tripId: string, travelerId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await ownTrip(a, tripId); if (!trip) return fail("Trip not found.");
  const count = await prisma.travelTraveler.count({ where: { tripId: trip.id } });
  if (count <= 1) return fail("A trip needs at least one traveller.");
  await prisma.travelTraveler.deleteMany({ where: { id: travelerId, tripId: trip.id } });
  refresh(slug); return { success: true, data: undefined };
}

// ---------------------------------------------------------------- service lines

export async function saveTravelItem(slug: string, tripId: string, input: { id?: string; kind: string; description: string; supplierId?: string; startDate?: string; confirmationRef?: string; status?: string; costPrice: number; sellPrice: number }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await ownTrip(a, tripId); if (!trip) return fail("Trip not found.");
  if (["COMPLETED", "CANCELLED"].includes(trip.status)) return fail("This trip is closed.");
  const description = str(input.description, 200); if (!description) return fail("Describe the service (e.g. Lagos–Dubai return flight).");
  const cost = money(input.costPrice), sell = money(input.sellPrice);
  if (Number.isNaN(cost) || Number.isNaN(sell)) return fail("Enter valid cost and selling prices.");
  let supplierId: string | null = null;
  if (input.supplierId) {
    const s = await prisma.travelSupplier.findFirst({ where: { id: input.supplierId, storeId: a.store.id }, select: { id: true } });
    if (!s) return fail("Supplier not found."); supplierId = s.id;
  }
  const data = { kind: oneOf(ITEM_KINDS, input.kind, "OTHER"), description, supplierId, startDate: optDate(input.startDate), confirmationRef: optStr(input.confirmationRef, 60), status: oneOf(ITEM_STATUSES, input.status, "PENDING"), costPrice: cost, sellPrice: sell };
  if (input.id) {
    const it = await prisma.travelTripItem.findFirst({ where: { id: input.id, tripId: trip.id } });
    if (!it) return fail("Service line not found.");
    await prisma.travelTripItem.update({ where: { id: it.id }, data });
  } else {
    await prisma.travelTripItem.create({ data: { ...data, tripId: trip.id } });
  }
  await recalcTrip(trip.id);
  refresh(slug); return { success: true, data: undefined };
}

export async function removeTravelItem(slug: string, tripId: string, itemId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await ownTrip(a, tripId); if (!trip) return fail("Trip not found.");
  if (["COMPLETED", "CANCELLED"].includes(trip.status)) return fail("This trip is closed.");
  await prisma.travelTripItem.deleteMany({ where: { id: itemId, tripId: trip.id } });
  await recalcTrip(trip.id);
  refresh(slug); return { success: true, data: undefined };
}

// ---------------------------------------------------------------- payments

export async function recordTravelPayment(slug: string, tripId: string, input: { amount: number; method: string; reference?: string; note?: string; dueDate?: string; scheduleOnly?: boolean }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, storeId: a.store.id }, include: { payments: true } });
  if (!trip) return fail("Trip not found.");
  if (trip.status === "CANCELLED") return fail("This trip is cancelled.");
  const amount = money(input.amount);
  if (Number.isNaN(amount) || amount <= 0) return fail("Enter an amount greater than zero.");
  const m = tripMoney(trip, trip.payments);
  if (!input.scheduleOnly && Number(trip.totalPrice) > 0 && amount > m.balance + 0.005) return fail(`That is more than the outstanding balance (${m.balance.toLocaleString()}).`);
  const due = optDate(input.dueDate);
  if (input.scheduleOnly && !due) return fail("Choose a due date for the instalment.");
  await prisma.travelPayment.create({ data: { tripId: trip.id, amount, method: oneOf(PAYMENT_METHODS, input.method, "TRANSFER"), status: input.scheduleOnly ? "DUE" : "RECEIVED", dueDate: due, paidAt: input.scheduleOnly ? null : new Date(), reference: optStr(input.reference, 80), note: optStr(input.note, 300) } });
  refresh(slug); return { success: true, data: undefined };
}

export async function markTravelPaymentReceived(slug: string, tripId: string, paymentId: string, input: { method: string; reference?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await ownTrip(a, tripId); if (!trip) return fail("Trip not found.");
  const res = await prisma.travelPayment.updateMany({ where: { id: paymentId, tripId: trip.id, status: "DUE" }, data: { status: "RECEIVED", paidAt: new Date(), method: oneOf(PAYMENT_METHODS, input.method, "TRANSFER"), reference: optStr(input.reference, 80) } });
  if (!res.count) return fail("That instalment is no longer due.");
  refresh(slug); return { success: true, data: undefined };
}

export async function voidTravelPayment(slug: string, tripId: string, paymentId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await ownTrip(a, tripId); if (!trip) return fail("Trip not found.");
  await prisma.travelPayment.updateMany({ where: { id: paymentId, tripId: trip.id, status: { not: "VOID" } }, data: { status: "VOID" } });
  refresh(slug); return { success: true, data: undefined };
}

// ---------------------------------------------------------------- suppliers & packages

export async function saveTravelSupplier(slug: string, input: { id?: string; name: string; kind: string; contactName?: string; email?: string; phone?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const name = str(input.name, 120); if (name.length < 2) return fail("Enter the supplier name.");
  const data = { name, kind: oneOf(SUPPLIER_KINDS, input.kind, "OTHER"), contactName: optStr(input.contactName, 120), email: optStr(input.email, 160), phone: optStr(input.phone, 40) };
  if (input.id) {
    const res = await prisma.travelSupplier.updateMany({ where: { id: input.id, storeId: a.store.id }, data });
    if (!res.count) return fail("Supplier not found.");
  } else {
    await prisma.travelSupplier.create({ data: { ...data, storeId: a.store.id } });
  }
  refresh(slug); return { success: true, data: undefined };
}

export async function archiveTravelSupplier(slug: string, supplierId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  await prisma.travelSupplier.updateMany({ where: { id: supplierId, storeId: a.store.id }, data: { isArchived: true } });
  refresh(slug); return { success: true, data: undefined };
}

export async function saveTravelPackage(slug: string, input: { id?: string; name: string; destination: string; durationDays: number; pricePerPerson: number; departureDate?: string; seats?: number; inclusions?: string; depositPercent?: number; isActive?: boolean }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const name = str(input.name, 140), destination = str(input.destination, 120);
  if (!name || !destination) return fail("Name and destination are required.");
  const price = money(input.pricePerPerson); if (Number.isNaN(price) || price <= 0) return fail("Enter a price per person.");
  const days = Math.floor(Number(input.durationDays)); if (!(days >= 1 && days <= 365)) return fail("Duration must be between 1 and 365 days.");
  const seats = Math.max(0, Math.floor(Number(input.seats) || 0));
  const depositPercent = Math.floor(Number(input.depositPercent ?? 30));
  if (!(depositPercent >= 0 && depositPercent <= 100)) return fail("Deposit must be between 0% and 100%.");
  const data = { depositPercent, name, destination, durationDays: days, pricePerPerson: price, departureDate: optDate(input.departureDate), seats, inclusions: optStr(input.inclusions, 3000), isActive: input.isActive !== false, currency: a.store.currency || "NGN" };
  if (input.id) {
    const res = await prisma.travelPackage.updateMany({ where: { id: input.id, storeId: a.store.id }, data });
    if (!res.count) return fail("Package not found.");
  } else {
    await prisma.travelPackage.create({ data: { ...data, storeId: a.store.id } });
  }
  refresh(slug); return { success: true, data: undefined };
}

// ---------------------------------------------------------------- visa cases

export async function createTravelVisaCase(slug: string, input: { clientId: string; country: string; visaType: string; fee?: number; appointmentAt?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const client = await prisma.travelClient.findFirst({ where: { id: input.clientId, storeId: a.store.id }, select: { id: true } });
  if (!client) return fail("Choose a client.");
  const country = str(input.country, 80); if (!country) return fail("Enter the destination country.");
  const fee = input.fee === undefined || (input.fee as unknown) === "" ? 0 : money(input.fee); if (Number.isNaN(fee)) return fail("Enter a valid fee.");
  await prisma.travelVisaCase.create({ data: { storeId: a.store.id, clientId: client.id, country, visaType: oneOf(VISA_TYPES, input.visaType, "TOURIST"), fee, appointmentAt: optDate(input.appointmentAt), checklist: DEFAULT_VISA_CHECKLIST.map((label) => ({ label, done: false })) } });
  refresh(slug); return { success: true, data: undefined };
}

export async function updateTravelVisaCase(slug: string, caseId: string, input: { status?: string; toggleChecklistIndex?: number; notes?: string; appointmentAt?: string | null }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const c = await prisma.travelVisaCase.findFirst({ where: { id: caseId, storeId: a.store.id } });
  if (!c) return fail("Visa case not found.");
  const data: Record<string, unknown> = {};
  if (input.status !== undefined) {
    if (!(VISA_STATUSES as readonly string[]).includes(input.status)) return fail("Unknown status.");
    data.status = input.status;
    if (input.status === "SUBMITTED" && !c.submittedAt) data.submittedAt = new Date();
  }
  if (input.toggleChecklistIndex !== undefined) {
    const list = (Array.isArray(c.checklist) ? c.checklist : []) as { label: string; done: boolean }[];
    const i = input.toggleChecklistIndex;
    if (!Number.isInteger(i) || i < 0 || i >= list.length) return fail("Checklist item not found.");
    data.checklist = list.map((x, idx) => (idx === i ? { ...x, done: !x.done } : x));
  }
  if (input.notes !== undefined) data.notes = optStr(input.notes, 2000);
  if (input.appointmentAt !== undefined) data.appointmentAt = optDate(input.appointmentAt);
  await prisma.travelVisaCase.update({ where: { id: c.id }, data });
  refresh(slug); return { success: true, data: undefined };
}

// ---------------------------------------------------------------- payment links

/** Creates an online payment link for (part of) a trip's balance, to send to the traveller. */
export async function createTravelPaymentLink(slug: string, tripId: string, amount: number): Promise<ActionResult<{ url: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, storeId: a.store.id }, include: { payments: true, client: true } });
  if (!trip) return fail("Trip not found.");
  if (["CANCELLED", "COMPLETED"].includes(trip.status)) return fail("This trip is closed.");
  if (!canPayOnline(trip.currency)) return fail("Online payment links are only available for trips priced in NGN.");
  const m = tripMoney(trip, trip.payments);
  if (!(m.total > 0)) return fail("Set a price before requesting payment.");
  const amt = money(amount);
  if (Number.isNaN(amt) || amt <= 0) return fail("Enter an amount greater than zero.");
  if (amt > m.balance + 0.005) return fail(`That is more than the outstanding balance (${m.balance.toLocaleString()}).`);
  const store = await prisma.store.findUnique({ where: { id: a.store.id }, select: { id: true, slug: true, customDomain: true, customDomainStatus: true, paystackSubaccountCode: true, flutterwaveSubaccountId: true } });
  if (!store) return fail("Store not found.");
  const r = await startTravelCharge({ store, tripId: trip.id, amountNaira: amt, currency: trip.currency, email: trip.client.email, customerName: trip.client.fullName });
  if (!r.success) return fail(r.error);
  return { success: true, data: { url: r.url } };
}
