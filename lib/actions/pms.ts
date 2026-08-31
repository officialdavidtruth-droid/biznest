"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { hasCapability } from "@/lib/capabilities";
import { chargeCustomer, getActiveGateway } from "@/lib/payments/gateway";
import type { ActionResult } from "@/types/actions";
import crypto from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

async function access(slug: string) {
  // PMS is a premium vertical app. It is deliberately enforced on the
  // server so hiding the navigation item can never be mistaken for access
  // control. The Business Mogul plan is the only plan that can use it.
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return a;
  if (!hasCapability(a.store.business.category, "pms")) {
    return { success: false as const, error: "PMS is only available to hotel and property businesses." };
  }
  const subscription = await prisma.subscription.findUnique({
    where: { id: a.store.subscriptionId ?? "" },
    select: { name: true },
  });
  if (subscription?.name !== "Business Mogul") {
    return { success: false as const, error: "BizNest PMS is available exclusively on the Business Mogul plan." };
  }
  return a;
}

export async function getPmsAccessStatus(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { allowed: false as const, error: a.error };
  if (!hasCapability(a.store.business.category, "pms")) {
    return { allowed: false as const, error: "PMS is only available to hotel and property businesses." };
  }
  const subscription = await prisma.subscription.findUnique({
    where: { id: a.store.subscriptionId ?? "" },
    select: { name: true },
  });
  if (subscription?.name !== "Business Mogul") {
    return { allowed: false as const, error: "BizNest PMS is available exclusively on the Business Mogul plan." };
  }
  return { allowed: true as const };
}

export async function getPmsData(slug: string) {
  const a = await access(slug); if (!a.success) return null;
  const [rooms, guests, reservations] = await Promise.all([
    prisma.propertyRoom.findMany({ where: { storeId: a.store.id }, orderBy: { name: "asc" } }),
    prisma.propertyGuest.findMany({ where: { storeId: a.store.id }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.propertyReservation.findMany({ where: { storeId: a.store.id }, include: { guest: true, room: true }, orderBy: { checkIn: "asc" }, take: 100 }),
  ]);
  // depositAmount is a Prisma Decimal (a decimal.js class instance), not a
  // plain JS value — React Server Components can't serialize it across the
  // server -> client boundary, so passing it straight into <PmsControls>
  // (a "use client" component) throws and lands on the admin error
  // boundary. Converting to a plain number here is the same fix already
  // used for Decimal fields elsewhere (e.g. Number(order.total) in
  // lib/actions/order.ts).
  const plainReservations = reservations.map((r) => ({
    ...r,
    depositAmount: r.depositAmount === null ? null : Number(r.depositAmount),
  }));
  return { rooms, guests, reservations: plainReservations };
}

export async function createRoom(slug: string, input: { name: string; roomType: string }): Promise<ActionResult<{id:string}>> {
  const a = await access(slug); if (!a.success) return { success:false,error:a.error };
  const name=input.name.trim(), roomType=input.roomType.trim();
  if(!name||!roomType) return {success:false,error:"Room name and type are required."};
  const exists=await prisma.propertyRoom.findFirst({where:{storeId:a.store.id,name}});
  if(exists) return {success:false,error:"That room already exists."};
  const row=await prisma.propertyRoom.create({data:{storeId:a.store.id,name,roomType}});
  revalidatePath(`/store/${slug}/admin/pms`);
  return {success:true,data:{id:row.id}};
}

export async function updateRoomStatus(slug:string, roomId:string,status:"AVAILABLE"|"OCCUPIED"|"RESERVED"|"DIRTY"|"CLEANING"|"MAINTENANCE"|"OUT_OF_SERVICE"):Promise<ActionResult>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const room=await prisma.propertyRoom.findFirst({where:{id:roomId,storeId:a.store.id}});if(!room)return{success:false,error:"Room not found."};

 // A room with a guest currently checked in shouldn't be manually flipped
 // to AVAILABLE or OUT_OF_SERVICE out from under that stay — check them
 // out first. (OCCUPIED/DIRTY/CLEANING/MAINTENANCE are all fine to set
 // freely; they don't contradict an active stay.)
 if(status==="AVAILABLE"||status==="OUT_OF_SERVICE"){
  const activeStay=await prisma.propertyReservation.findFirst({where:{roomId,status:"CHECKED_IN"}});
  if(activeStay)return{success:false,error:"This room has a guest checked in — check them out before changing its status."};
 }

 // Taking a room out of service shouldn't silently strand upcoming
 // reservations against it.
 if(status==="OUT_OF_SERVICE"){
  const upcoming=await prisma.propertyReservation.findFirst({where:{roomId,status:{in:["PENDING","CONFIRMED"]},checkOut:{gt:new Date()}}});
  if(upcoming)return{success:false,error:"This room has upcoming reservations — cancel or reassign them before marking it out of service."};
 }

 await prisma.propertyRoom.update({where:{id:roomId},data:{status}});
 revalidatePath(`/store/${slug}/admin/pms`);return{success:true,data:undefined};
}

export async function createGuest(slug:string,input:{fullName:string;email?:string;phone?:string;notes?:string}):Promise<ActionResult<{id:string}>>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const fullName=input.fullName.trim();if(fullName.length<2)return{success:false,error:"Guest name is required."};
 const row=await prisma.propertyGuest.create({data:{storeId:a.store.id,fullName,email:input.email?.trim()||null,phone:input.phone?.trim()||null,notes:input.notes?.trim()||null}});
 revalidatePath(`/store/${slug}/admin/pms`);return{success:true,data:{id:row.id}};
}

export async function createReservation(slug:string,input:{guestId:string;roomId:string;checkIn:string;checkOut:string;notes?:string}):Promise<ActionResult<{id:string}>>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const checkIn=new Date(input.checkIn),checkOut=new Date(input.checkOut);
 if(!Number.isFinite(checkIn.getTime())||!Number.isFinite(checkOut.getTime())||checkOut<=checkIn)return{success:false,error:"Check-out must be after check-in."};
 const [guest,room]=await Promise.all([
  prisma.propertyGuest.findFirst({where:{id:input.guestId,storeId:a.store.id}}),
  prisma.propertyRoom.findFirst({where:{id:input.roomId,storeId:a.store.id}}),
 ]);
 if(!guest||!room)return{success:false,error:"Guest or room does not belong to this store."};

 // The overlap check and the insert used to be two separate round-trips,
 // so two concurrent booking attempts for the same room/dates could both
 // pass the check before either row existed, double-booking the room.
 // pg_advisory_xact_lock serializes concurrent attempts *for this room*
 // (the lock auto-releases at transaction end, success or failure), so
 // the overlap check and the create are effectively one atomic step.
 const result=await prisma.$transaction(async(tx)=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${room.id})::bigint)`;

  const overlap=await tx.propertyReservation.findFirst({where:{storeId:a.store.id,roomId:room.id,status:{in:["PENDING","CONFIRMED","CHECKED_IN"]},checkIn:{lt:checkOut},checkOut:{gt:checkIn}}});
  if(overlap)return{success:false as const,error:"That room is already reserved for part of those dates."};

  const row=await tx.propertyReservation.create({data:{storeId:a.store.id,guestId:guest.id,roomId:room.id,checkIn,checkOut,status:"CONFIRMED",notes:input.notes?.trim()||null}});
  if(room.status==="AVAILABLE") await tx.propertyRoom.update({where:{id:room.id},data:{status:"RESERVED"}});
  return{success:true as const,data:{id:row.id}};
 });

 if(!result.success)return result;
 revalidatePath(`/store/${slug}/admin/pms`);return result;
}

export async function setGuestPresence(slug:string,reservationId:string,presence:"IN"|"OUT"):Promise<ActionResult>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const r=await prisma.propertyReservation.findFirst({where:{id:reservationId,storeId:a.store.id},include:{room:true}});
 if(!r)return{success:false,error:"Reservation not found."};
 if(r.status!=="CHECKED_IN")return{success:false,error:"Guest presence can only be changed for a checked-in guest."};
 await prisma.propertyReservation.update({where:{id:r.id},data:{guestPresence:presence}});
 revalidatePath(`/store/${slug}/admin/pms`);return{success:true,data:undefined};
}

export async function checkInReservation(slug:string,id:string):Promise<ActionResult>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const r=await prisma.propertyReservation.findFirst({where:{id,storeId:a.store.id},include:{room:true}});
 if(!r)return{success:false,error:"Reservation not found."};
 if(!["PENDING","CONFIRMED"].includes(r.status))return{success:false,error:"Reservation cannot be checked in."};

 const now=new Date();
 // Same-day early arrival is normal for hotels, so allow check-in from the
 // start of the reservation's check-in calendar day onward — just not
 // before that day at all.
 const checkInDayStart=new Date(r.checkIn.getFullYear(),r.checkIn.getMonth(),r.checkIn.getDate());
 if(now<checkInDayStart)return{success:false,error:`This reservation isn't due to check in until ${r.checkIn.toLocaleDateString()}.`};
 // If the whole stay window already elapsed without a check-in, checking
 // in now would create a nonsensical stay (checked-in after check-out).
 // The room was never actually occupied for these dates, so route the
 // operator to mark it a no-show instead of forcing a stale check-in.
 if(now>r.checkOut)return{success:false,error:"This reservation's dates have already passed — mark it as a no-show instead."};

 await prisma.$transaction([
  prisma.propertyReservation.update({where:{id},data:{status:"CHECKED_IN",checkedInAt:new Date(),guestPresence:"IN"}}),
  prisma.propertyRoom.update({where:{id:r.roomId},data:{status:"OCCUPIED"}})
 ]);
 revalidatePath(`/store/${slug}/admin/pms`);return{success:true,data:undefined};
}

export async function checkOutReservation(slug:string,id:string):Promise<ActionResult>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const r=await prisma.propertyReservation.findFirst({where:{id,storeId:a.store.id}});
 if(!r)return{success:false,error:"Reservation not found."};
 if(r.status!=="CHECKED_IN")return{success:false,error:"Only checked-in guests can check out."};
 await prisma.$transaction([
  prisma.propertyReservation.update({where:{id},data:{status:"CHECKED_OUT",checkedOutAt:new Date(),guestPresence:"OUT"}}),
  prisma.propertyRoom.update({where:{id:r.roomId},data:{status:"DIRTY"}})
 ]);
 revalidatePath(`/store/${slug}/admin/pms`);return{success:true,data:undefined};
}

/**
 * Cancels a reservation that never made it to check-in (or is still
 * pending/confirmed). Frees the room back to AVAILABLE, but only if the
 * room is still sitting RESERVED for this booking — never touches
 * OCCUPIED/DIRTY/CLEANING/MAINTENANCE/OUT_OF_SERVICE, since those reflect
 * real physical room state independent of any one reservation.
 */
export async function cancelReservation(slug:string,id:string,reason?:string):Promise<ActionResult>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const r=await prisma.propertyReservation.findFirst({where:{id,storeId:a.store.id}});
 if(!r)return{success:false,error:"Reservation not found."};
 if(!["PENDING","CONFIRMED"].includes(r.status))return{success:false,error:"Only pending or confirmed reservations can be cancelled."};
 const trimmedReason=reason?.trim();
 await prisma.$transaction([
  prisma.propertyReservation.update({where:{id},data:{
   status:"CANCELLED",
   cancelledAt:new Date(),
   notes:trimmedReason?`${r.notes?`${r.notes}\n`:""}Cancelled: ${trimmedReason}`:r.notes,
  }}),
  prisma.propertyRoom.updateMany({where:{id:r.roomId,status:"RESERVED"},data:{status:"AVAILABLE"}}),
 ]);
 revalidatePath(`/store/${slug}/admin/pms`);return{success:true,data:undefined};
}

/**
 * Marks a confirmed reservation as a no-show (guest never arrived).
 * Same room-release logic as cancelReservation.
 */
export async function markReservationNoShow(slug:string,id:string):Promise<ActionResult>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const r=await prisma.propertyReservation.findFirst({where:{id,storeId:a.store.id}});
 if(!r)return{success:false,error:"Reservation not found."};
 if(!["PENDING","CONFIRMED"].includes(r.status))return{success:false,error:"Only pending or confirmed reservations can be marked as a no-show."};
 await prisma.$transaction([
  prisma.propertyReservation.update({where:{id},data:{status:"NO_SHOW",cancelledAt:new Date()}}),
  prisma.propertyRoom.updateMany({where:{id:r.roomId,status:"RESERVED"},data:{status:"AVAILABLE"}}),
 ]);
 revalidatePath(`/store/${slug}/admin/pms`);return{success:true,data:undefined};
}

/* -------------------------------------------------------------------------- */
/* PAYMENTS                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Requests a deposit/stay charge for a reservation. Nothing in PMS forces
 * a hotel to use this — reservations work fine with paymentStatus staying
 * UNPAID — but if a property wants to collect payment, this reuses the
 * exact same gateway + subaccount-split + Payment-row pattern every other
 * purpose in the app uses (see chargeExistingOrder in lib/actions/order.ts
 * and startBookingPayment in lib/actions/customer-wallet.ts), rather than
 * PMS inventing its own untracked side channel for money.
 *
 * Returns a hosted checkout link. There's no guest-facing PMS page yet, so
 * the operator is expected to send this link to the guest directly (email/
 * SMS/WhatsApp) — settlement still runs through the standard webhook and
 * callback routes regardless of how the guest reaches the link.
 */
export async function chargeReservationDeposit(
 slug:string,
 reservationId:string,
 amountNaira:number,
 guestEmail?:string
):Promise<ActionResult<{authorizationUrl:string}>>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};

 if(!Number.isFinite(amountNaira)||amountNaira<=0)return{success:false,error:"Enter a valid amount."};

 const reservation=await prisma.propertyReservation.findFirst({where:{id:reservationId,storeId:a.store.id},include:{guest:true}});
 if(!reservation)return{success:false,error:"Reservation not found."};
 if(reservation.paymentStatus==="PAID")return{success:false,error:"This reservation is already paid."};
 if(!["PENDING","CONFIRMED","CHECKED_IN"].includes(reservation.status))return{success:false,error:"Cannot charge a cancelled, no-show, or checked-out reservation."};

 const gateway=await getActiveGateway();
 const hasPayoutTarget=gateway==="PAYSTACK"?Boolean(a.store.paystackSubaccountCode):Boolean(a.store.flutterwaveSubaccountId);
 if(!hasPayoutTarget)return{success:false,error:"This store has not connected a payout account yet."};

 const reference=`RES-${reservation.id}-${crypto.randomUUID()}`;
 const callbackUrl=gateway==="FLUTTERWAVE"?`${APP_URL}/api/payments/flutterwave/callback`:`${APP_URL}/api/payments/paystack/callback`;
 const currency="NGN";

 const charge=await chargeCustomer({
  email:guestEmail?.trim()||reservation.guest.email||"guest@biznest.space",
  customerName:reservation.guest.fullName,
  amountNaira,
  reference,
  callbackUrl,
  paystackSubaccountCode:a.store.paystackSubaccountCode,
  flutterwaveSubaccountId:a.store.flutterwaveSubaccountId,
 });

 if(!charge.success)return{success:false,error:charge.error};

 await prisma.$transaction([
  prisma.propertyReservation.update({where:{id:reservation.id},data:{paymentStatus:"PENDING",depositAmount:amountNaira,paymentCurrency:currency}}),
  prisma.payment.create({data:{
   storeId:a.store.id,
   reservationId:reservation.id,
   purpose:"PMS_RESERVATION",
   provider:charge.gateway,
   reference,
   status:"PENDING",
   amount:amountNaira,
   currency,
   splitSubaccountCode:charge.splitSubaccountCode,
  }}),
 ]);

 revalidatePath(`/store/${slug}/admin/pms`);
 return{success:true,data:{authorizationUrl:charge.authorizationUrl}};
}

/**
 * Settles a PMS reservation payment. Called from the Paystack/Flutterwave
 * webhook and callback routes for references starting "RES-", the same
 * way settleServiceBookingPayment (lib/actions/customer-wallet.ts) is
 * called for "BK-" references.
 */
export async function settleReservationPayment(
 reference:string,
 provider:"PAYSTACK"|"FLUTTERWAVE",
 verifiedAmountNaira:number,
 rawPayload:object
):Promise<ActionResult<{storeSlug:string;reservationId:string}>>{
 const payment=await prisma.payment.findUnique({where:{reference},include:{reservation:{include:{store:true}}}});
 if(!payment||payment.purpose!=="PMS_RESERVATION"||!payment.reservation)return{success:false,error:"Reservation payment not found."};
 if(payment.provider!==provider)return{success:false,error:"Payment provider mismatch."};
 if(payment.status==="SUCCESSFUL")return{success:true,data:{storeSlug:payment.reservation.store.slug,reservationId:payment.reservation.id}};
 if(payment.status!=="PENDING")return{success:false,error:"Reservation payment is not pending."};
 if(verifiedAmountNaira<Number(payment.amount))return{success:false,error:"Payment amount mismatch."};

 await prisma.$transaction(async(tx)=>{
  const result=await tx.payment.updateMany({where:{id:payment.id,status:"PENDING"},data:{status:"SUCCESSFUL",rawPayload,verifiedAt:new Date()}});
  if(result.count===0)return;
  await tx.propertyReservation.updateMany({where:{id:payment.reservation!.id,paymentStatus:{not:"PAID"}},data:{paymentStatus:"PAID",paymentReference:reference}});
 });

 revalidatePath(`/store/${payment.reservation.store.slug}/admin/pms`);
 return{success:true,data:{storeSlug:payment.reservation.store.slug,reservationId:payment.reservation.id}};
                                                           }
   
