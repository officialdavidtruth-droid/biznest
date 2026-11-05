"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getPluginEntitlement } from "@/lib/plugins";
import { newTripReference, TRAVEL_PLUGIN_KEY, depositFor } from "@/lib/travel";
import { seatCapacity, seatsHeld } from "@/lib/travel-seats";
import { bookingClosedByCutoff } from "@/lib/travel-growth";
import { startTravelCharge, travelOnlinePaymentError } from "@/lib/payments/travel-charge";
import type { ActionResult } from "@/types/actions";

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

/**
 * Public enquiry from a storefront. Creates (or reuses) a client and an ENQUIRY trip file the agency
 * follows up. Price always comes from the package, never from the browser. Seats are not held until the
 * agency confirms, so enquiries cannot block a tour.
 */
type EnquiryInput = { packageId?: string; departureId?: string; fullName: string; phone: string; email?: string; travellers?: number; message?: string; website?: string };

export async function submitTravelEnquiry(slug: string, input: EnquiryInput): Promise<ActionResult<{ reference: string }>> {
  const r = await handle(slug, input, false);
  return r.success ? { success: true, data: { reference: r.data.reference } } : r;
}

/**
 * Book now: same as an enquiry, then sends the visitor to pay the deposit (percent of the tour price set by
 * the agency). The trip becomes CONFIRMED only when the payment settles and seats are still available.
 */
export async function startTravelBooking(slug: string, input: EnquiryInput): Promise<ActionResult<{ reference: string; paymentUrl: string }>> {
  const r = await handle(slug, input, true);
  if (!r.success) return r;
  if (!r.data.paymentUrl) return { success: false, error: "Online booking isn't available for this tour. Please send an enquiry instead." };
  return { success: true, data: { reference: r.data.reference, paymentUrl: r.data.paymentUrl } };
}

async function handle(slug: string, input: EnquiryInput, book: boolean): Promise<ActionResult<{ reference: string; paymentUrl?: string }>> {
  // Honeypot: real visitors never fill this hidden field.
  if (clean(input.website, 50)) return { success: true, data: { reference: "TRV-RECEIVED" } };

  const fullName = clean(input.fullName, 120);
  const phone = clean(input.phone, 40);
  const email = clean(input.email, 160) || null;
  if (fullName.length < 2) return { success: false, error: "Please enter your name." };
  if (phone.replace(/\D/g, "").length < 7) return { success: false, error: "Please enter a phone number we can reach you on." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Please enter a valid email address." };
  const count = Math.max(1, Math.min(30, Math.floor(Number(input.travellers) || 1)));

  const ip = getClientIp(await headers());
  const burst = await checkRateLimit(`travel-enq-ip:${ip}`, 5, 10 * 60 * 1000);
  const hourly = await checkRateLimit(`travel-enq-ip-h:${ip}`, 20, 60 * 60 * 1000);
  if (!burst.allowed || !hourly.allowed) return { success: false, error: "Too many requests. Please wait a few minutes and try again." };

  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, status: true, currency: true, customDomain: true, customDomainStatus: true } });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "This store is not accepting enquiries." };
  const ent = await getPluginEntitlement(store.id, TRAVEL_PLUGIN_KEY).catch(() => null);
  if (!ent || !ent.allowed || !ent.installed) return { success: false, error: "This store is not accepting enquiries." };
  const perStore = await checkRateLimit(`travel-enq-store:${store.id}`, 60, 10 * 60 * 1000);
  if (!perStore.allowed) return { success: false, error: "This agency is receiving a lot of enquiries. Please try again shortly." };

  if (book && !input.packageId) return { success: false, error: "Choose a tour to book, or send a general enquiry." };
  let pkg: { id: string; name: string; destination: string; durationDays: number; pricePerPerson: unknown; currency: string; departureDate: Date | null; seats: number; depositPercent: number } | null = null;
  let dep: { id: string; departureDate: Date; pricePerPerson: unknown; cutoffDays: number } | null = null;
  if (input.packageId) {
    pkg = await prisma.travelPackage.findFirst({ where: { id: String(input.packageId), storeId: store.id, isActive: true } });
    if (!pkg) return { success: false, error: "That tour is no longer available." };
    if (input.departureId) {
      dep = await prisma.travelDeparture.findFirst({ where: { id: String(input.departureId), packageId: pkg.id, storeId: store.id, isActive: true }, select: { id: true, departureDate: true, pricePerPerson: true, cutoffDays: true } });
      if (!dep) return { success: false, error: "That departure is no longer available." };
    }
    if (book && bookingClosedByCutoff(dep?.departureDate ?? pkg.departureDate, dep?.cutoffDays ?? 0)) return { success: false, error: "Online booking has closed for this departure. Please send an enquiry and we will help you." };
    const pool = await seatCapacity(prisma, pkg.id, dep?.id ?? null);
    if (pool && pool.capacity > 0) {
      const taken = await seatsHeld(prisma, pkg.id, dep?.id ?? null);
      if (count > pool.capacity - taken) return { success: false, error: `Only ${Math.max(0, pool.capacity - taken)} seat(s) left on this tour.` };
    }
  }

  // Reuse an existing client with the same phone or email, without overwriting their saved details.
  const existing = await prisma.travelClient.findFirst({ where: { storeId: store.id, OR: [{ phone }, ...(email ? [{ email }] : [])] } });
  // Cap open enquiries per contact so one person (or script) cannot flood the agency's inbox.
  if (existing) {
    const open = await prisma.travelTrip.count({ where: { clientId: existing.id, status: "ENQUIRY" } });
    if (open >= 5) return { success: false, error: "We already have your enquiries and will be in touch shortly." };
  }
  const client = existing ?? (await prisma.travelClient.create({ data: { storeId: store.id, fullName, phone, email } }));

  if (book) {
    if (!pkg || pkg.depositPercent <= 0 || (await travelOnlinePaymentError(store.id, pkg.currency))) return { success: false, error: "Online booking isn't available for this tour. Please send an enquiry instead." };
  }
  const message = clean(input.message, 1000);
  const unitPrice = pkg ? Number(dep?.pricePerPerson ?? pkg.pricePerPerson) : 0;
  const startsOn = dep?.departureDate ?? pkg?.departureDate ?? null;
  const total = pkg ? Math.round(unitPrice * count * 100) / 100 : 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const trip = await prisma.travelTrip.create({
        data: {
          storeId: store.id, reference: newTripReference(new Date(), attempt), clientId: client.id, packageId: pkg?.id ?? null, departureId: dep?.id ?? null,
          title: pkg ? pkg.name : "Website enquiry", destination: pkg ? pkg.destination : "To be confirmed",
          departDate: startsOn,
          returnDate: startsOn && pkg ? new Date(startsOn.getTime() + (pkg.durationDays - 1) * 86_400_000) : null,
          currency: pkg?.currency ?? store.currency ?? "NGN", totalPrice: total,
          notes: `Website enquiry from ${fullName}${message ? `: ${message}` : ""}`,
          travellers: { create: Array.from({ length: count }, (_, i) => ({ fullName: i === 0 ? client.fullName : `Traveller ${i + 1}`, isLead: i === 0 })) },
        },
        select: { id: true, reference: true },
      });
      if (!book) return { success: true, data: { reference: trip.reference } };
      const full = await prisma.store.findUnique({ where: { id: store.id }, select: { id: true, slug: true, customDomain: true, customDomainStatus: true, paystackSubaccountCode: true, flutterwaveSubaccountId: true } });
      const deposit = depositFor(total, pkg!.depositPercent);
      const charge = full && deposit > 0
        ? await startTravelCharge({ store: full, tripId: trip.id, amountNaira: deposit, currency: pkg!.currency, email, customerName: fullName })
        : { success: false as const, error: "Online booking isn't available for this tour." };
      // The trip file exists either way, so the agency can follow up if checkout could not start.
      if (!charge.success) return { success: false, error: `${charge.error} We saved your request (ref ${trip.reference}) and the agency will contact you.` };
      return { success: true, data: { reference: trip.reference, paymentUrl: charge.url } };
    } catch (e: any) { if (e?.code !== "P2002") throw e; }
  }
  return { success: false, error: "Something went wrong. Please try again." };
}
