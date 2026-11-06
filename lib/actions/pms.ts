"use server";

import { prisma } from "@/lib/prisma";
import { findBookingOverlapForUnit } from "@/lib/stay-availability";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { auth } from "@/lib/auth";
import { hasCapability } from "@/lib/capabilities";
import { getPluginEntitlement } from "@/lib/plugins";
import { chargeCustomer, resolveCheckoutGateway, paymentCallbackUrl } from "@/lib/payments/gateway";
import { createPendingPayment, markPaymentFailed, reconcileReservationPaymentState } from "@/lib/payments/pending";
import { resolvePayRoute, startManualTransfer } from "@/lib/payments/manual-flow";
import type { ActionResult } from "@/types/actions";
import crypto from "crypto";
import { shortToken } from "@/lib/payments/reference";
import { findChannelBlockOverlap } from "@/lib/channels/sync";
import { notifyRoomChanged, refreshRoomChannels } from "@/lib/channels/push";
import { formatDate } from "@/lib/i18n/locale";


async function access(slug: string) {
  // PMS is a premium vertical app. It is deliberately enforced on the
  // server so hiding the navigation item can never be mistaken for access
  // control. The Business Mogul plan is the only plan that can use it.
  const a = await assertStorePermission(slug, "plugin:pms");
  if (!a.success) return a;
  if (!hasCapability(a.store.business.category, "pms")) {
    return { success: false as const, error: "PMS is only available to hotel and property businesses." };
  }
  const entitlement = await getPluginEntitlement(a.store.id, "pms");
  if (!entitlement.allowed) return { success: false as const, error: entitlement.reason };
  if (!entitlement.installed) return { success: false as const, error: "Install BizNest PMS from Apps before opening the PMS workspace." };
  return a;
}

/**
 * Frees a room that was held RESERVED for a reservation that just ended
 * without a stay — but only if no other live reservation still needs it.
 * (A room is flipped to RESERVED by the first booking; releasing it when one
 * of several bookings is cancelled used to show it as free while another
 * guest was still due.)
 */
async function releaseRoomIfNoOtherStay(tx:Prisma.TransactionClient,roomId:string,endedReservationId:string){
 const other=await tx.propertyReservation.findFirst({where:{roomId,id:{not:endedReservationId},status:{in:["PENDING","CONFIRMED"]},checkOut:{gt:new Date()}},select:{id:true}});
 if(!other)await tx.propertyRoom.updateMany({where:{id:roomId,status:"RESERVED"},data:{status:"AVAILABLE"}});
}

/**
 * room.status is stored, so it can drift from the reservations (a cancelled
 * booking elsewhere, a check-in done through another path, a booking that
 * becomes due today). Re-derive only the three states reservations decide —
 * AVAILABLE / RESERVED / OCCUPIED — and never touch DIRTY, CLEANING,
 * MAINTENANCE or OUT_OF_SERVICE, which staff set deliberately. A manually
 * set OCCUPIED (walk-in with no reservation) is also left alone.
 */
async function syncRoomStatuses(storeId:string){
 const now=new Date();
 const endOfToday=new Date(now);endOfToday.setHours(23,59,59,999);
 const [rooms,live]=await Promise.all([
  prisma.propertyRoom.findMany({where:{storeId,status:{in:["AVAILABLE","RESERVED"]}},select:{id:true,status:true}}),
  prisma.propertyReservation.findMany({where:{storeId,OR:[{status:"CHECKED_IN"},{status:{in:["PENDING","CONFIRMED"]},checkOut:{gt:now}}]},select:{roomId:true,status:true,checkIn:true}}),
 ]);
 const inHouse=new Set<string>(),due=new Set<string>();
 for(const r of live){
  if(r.status==="CHECKED_IN")inHouse.add(r.roomId);
  else if(r.checkIn<=endOfToday)due.add(r.roomId);
 }
 const toOccupied:string[]=[],toReserved:string[]=[],toAvailable:string[]=[];
 for(const room of rooms){
  if(inHouse.has(room.id))toOccupied.push(room.id);
  else if(room.status==="AVAILABLE"&&due.has(room.id))toReserved.push(room.id);
  else if(room.status==="RESERVED"&&!due.has(room.id)&&!live.some(l=>l.roomId===room.id))toAvailable.push(room.id);
 }
 // A RESERVED room whose only booking is further out stays RESERVED (createReservation set it); only rooms with no live booking at all are freed.
 await Promise.all([
  toOccupied.length?prisma.propertyRoom.updateMany({where:{id:{in:toOccupied},storeId,status:{in:["AVAILABLE","RESERVED"]}},data:{status:"OCCUPIED"}}):null,
  toReserved.length?prisma.propertyRoom.updateMany({where:{id:{in:toReserved},storeId,status:"AVAILABLE"},data:{status:"RESERVED"}}):null,
  toAvailable.length?prisma.propertyRoom.updateMany({where:{id:{in:toAvailable},storeId,status:"RESERVED"},data:{status:"AVAILABLE"}}):null,
 ]);
}

export async function getPmsAccessStatus(slug: string) {
  const a = await assertStorePermission(slug, "plugin:pms");
  if (!a.success) return { allowed: false as const, error: a.error };
  if (!hasCapability(a.store.business.category, "pms")) {
    return { allowed: false as const, error: "PMS is only available to hotel and property businesses." };
  }
  const entitlement = await getPluginEntitlement(a.store.id, "pms");
  if (!entitlement.allowed) return { allowed: false as const, error: entitlement.reason };
  return { allowed: entitlement.installed ? true as const : false as const, error: entitlement.installed ? undefined : "Install BizNest PMS from Apps before opening the PMS workspace." };
}

export async function getPmsData(slug: string) {
  const a = await access(slug); if (!a.success) return null;
  await syncRoomStatuses(a.store.id).catch(() => {}); // best effort: never block the workspace on a sync failure
  const [rooms, guests, reservations, cards, units, tickets] = await Promise.all([
    prisma.propertyRoom.findMany({ where: { storeId: a.store.id }, orderBy: { name: "asc" } }),
    prisma.propertyGuest.findMany({ where: { storeId: a.store.id }, orderBy: { updatedAt: "desc" }, take: 300 }),
    // Oldest-first with a hard cap used to cut off the newest bookings once a
    // property passed 100 reservations. Always include everything live (pending /
    // confirmed / checked in) plus the last 90 days of history.
    prisma.propertyReservation.findMany({
      where: { storeId: a.store.id, OR: [{ status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } }, { checkOut: { gte: new Date(Date.now() - 90 * 86_400_000) } }] },
      include: { guest: true, room: true }, orderBy: { checkIn: "asc" }, take: 1000,
    }),
    prisma.roomAccessCard.findMany({ where: { storeId: a.store.id }, include: { room: true, guest: true, reservation: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    // Online room units, so each PMS room can be linked to the same physical room.
    prisma.serviceUnit.findMany({ where: { storeId: a.store.id }, select: { id: true, label: true, service: { select: { name: true } } }, orderBy: [{ serviceId: "asc" }, { label: "asc" }] }),
    prisma.propertyMaintenanceTicket.findMany({ where: { storeId: a.store.id, OR: [{ status: "OPEN" }, { resolvedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }] }, orderBy: { reportedAt: "desc" }, take: 300 }),
  ]);
  // depositAmount is a Prisma Decimal (a decimal.js class instance), not a
  // plain JS value — React Server Components can't serialize it across the
  // server -> client boundary, so passing it straight into <PmsWorkspace>
  // (a "use client" component) throws and lands on the admin error
  // boundary. Converting to a plain number here is the same fix already
  // used for Decimal fields elsewhere (e.g. Number(order.total) in
  // lib/actions/order.ts).
  const plainReservations = reservations.map((r) => ({
    ...r,
    depositAmount: r.depositAmount === null ? null : Number(r.depositAmount),
  }));
  const plainCards = cards.map((card) => ({
    ...card,
    expiresAt: card.expiresAt?.toISOString() ?? null,
    activatedAt: card.activatedAt.toISOString(),
    revokedAt: card.revokedAt?.toISOString() ?? null,
  }));
  const plainUnits = units.map((u) => ({ id: u.id, label: u.label, serviceName: u.service.name }));
  const plainTickets = tickets.map((t) => ({ ...t, reportedAt: t.reportedAt.toISOString(), resolvedAt: t.resolvedAt?.toISOString() ?? null }));
  return { rooms, guests, reservations: plainReservations, cards: plainCards, units: plainUnits, tickets: plainTickets };
}

export async function activateRoomCard(
  slug: string,
  input: { roomId: string; cardUid: string; reservationId?: string; guestId?: string; label?: string; expiresAt?: string }
): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };

  const cardUid = input.cardUid.trim();
  if (!cardUid) return { success: false, error: "Card UID / card number is required." };
  if (cardUid.length > 120) return { success: false, error: "Card UID is too long." };

  const room = await prisma.propertyRoom.findFirst({ where: { id: input.roomId, storeId: a.store.id } });
  if (!room) return { success: false, error: "Room not found." };
  if (["OUT_OF_SERVICE", "MAINTENANCE"].includes(room.status)) return { success: false, error: "Cards cannot be activated for a room that is out of service or under maintenance." };

  const existing = await prisma.roomAccessCard.findUnique({ where: { storeId_cardUid: { storeId: a.store.id, cardUid } } });
  // A card that is past its expiry is no longer usable even though its row is still ACTIVE
  // (it is only flipped to REVOKED when someone scans it), so it can be reissued.
  if (existing?.status === "ACTIVE" && !(existing.expiresAt && existing.expiresAt <= new Date())) return { success: false, error: "This card is already active. Deactivate it before reusing it." };

  let reservation: any = null;
  if (input.reservationId) {
    reservation = await prisma.propertyReservation.findFirst({ where: { id: input.reservationId, storeId: a.store.id }, include: { guest: true, room: true } });
    if (!reservation) return { success: false, error: "Reservation not found." };
    if (reservation.roomId !== room.id) return { success: false, error: "The reservation does not belong to this room." };
    if (!["CONFIRMED", "CHECKED_IN"].includes(reservation.status)) return { success: false, error: "Only confirmed or checked-in reservations can receive room cards." };
    if (reservation.checkOut <= new Date()) return { success: false, error: "This reservation has already ended." };
    if (input.guestId && input.guestId !== reservation.guestId) return { success: false, error: "The selected guest does not belong to this reservation." };
  }

  let guestId = input.guestId || reservation?.guestId || undefined;
  if (guestId) {
    const guest = await prisma.propertyGuest.findFirst({ where: { id: guestId, storeId: a.store.id } });
    if (!guest) return { success: false, error: "Guest not found." };
  }

  let expiresAt: Date | null = reservation?.checkOut ?? null;
  if (input.expiresAt) {
    const parsed = new Date(input.expiresAt);
    if (Number.isNaN(parsed.getTime())) return { success: false, error: "Enter a valid card expiry date." };
    if (parsed <= new Date()) return { success: false, error: "Card expiry must be in the future." };
    if (reservation && parsed > reservation.checkOut) return { success: false, error: "A guest card cannot outlive the reservation checkout time." };
    expiresAt = parsed;
  }

  const card = existing
    ? await prisma.roomAccessCard.update({
        where: { id: existing.id },
        data: { roomId: room.id, cardUid, label: input.label?.trim() || null, reservationId: reservation?.id || null, guestId: guestId || null, status: "ACTIVE", activatedAt: new Date(), expiresAt, revokedAt: null, revokedReason: null },
        select: { id: true },
      })
    : await prisma.roomAccessCard.create({
        data: { storeId: a.store.id, roomId: room.id, cardUid, label: input.label?.trim() || null, reservationId: reservation?.id || null, guestId: guestId || null, expiresAt },
        select: { id: true },
      });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: { id: card.id } };
}

export async function revokeRoomCard(slug: string, cardId: string, reason?: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const card = await prisma.roomAccessCard.findFirst({ where: { id: cardId, storeId: a.store.id } });
  if (!card) return { success: false, error: "Room card not found." };
  if (card.status === "REVOKED") return { success: true, data: undefined };
  await prisma.roomAccessCard.update({ where: { id: card.id }, data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason?.trim() || "Deactivated by hotel staff" } });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

export async function validateRoomCard(slug: string, cardUid: string): Promise<ActionResult<{ valid: boolean; roomId?: string; roomName?: string; guestName?: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const uid = cardUid.trim();
  if (!uid) return { success: false, error: "Card UID is required." };
  const card = await prisma.roomAccessCard.findFirst({ where: { storeId: a.store.id, cardUid: uid, status: "ACTIVE" }, include: { room: true, guest: true } });
  if (!card) return { success: true, data: { valid: false } };
  if (card.expiresAt && card.expiresAt <= new Date()) {
    await prisma.roomAccessCard.update({ where: { id: card.id }, data: { status: "REVOKED", revokedAt: new Date(), revokedReason: "Card expired" } });
    revalidatePath(`/store/${slug}/admin/pms`);
    return { success: true, data: { valid: false } };
  }
  return { success: true, data: { valid: true, roomId: card.roomId, roomName: card.room.name, guestName: card.guest?.fullName } };
}

export async function revokeReservationCards(slug: string, reservationId: string, reason = "Reservation ended"): Promise<ActionResult<{ count: number }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const reservation = await prisma.propertyReservation.findFirst({ where: { id: reservationId, storeId: a.store.id }, select: { id: true } });
  if (!reservation) return { success: false, error: "Reservation not found." };
  const result = await prisma.roomAccessCard.updateMany({ where: { storeId: a.store.id, reservationId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason } });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: { count: result.count } };
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
 if(checkOut<=new Date())return{success:false,error:"Check-out must be in the future."};
 if(room.status==="OUT_OF_SERVICE")return{success:false,error:"This room is out of service and can't be reserved."};

 // Read any OTA calendar that is more than a few minutes old first, so the check below sees fresh sales.
 await refreshRoomChannels(room.id);

 // The overlap check and the insert used to be two separate round-trips,
 // so two concurrent booking attempts for the same room/dates could both
 // pass the check before either row existed, double-booking the room.
 // pg_advisory_xact_lock serializes concurrent attempts *for this room*
 // (the lock auto-releases at transaction end, success or failure), so
 // the overlap check and the create are effectively one atomic step.
 // Serializable (not just the per-room lock) because online bookings are written
 // under Serializable too: that lets Postgres detect a PMS reservation and an
 // online booking racing for the same physical room. The loser is retried.
 let result:{success:true;data:{id:string}}|{success:false;error:string}|null=null;
 for(let attempt=1;attempt<=3&&!result;attempt++){
  try{
   result=await prisma.$transaction(async(tx)=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${room.id})::bigint)`;

    const overlap=await tx.propertyReservation.findFirst({where:{storeId:a.store.id,roomId:room.id,status:{in:["PENDING","CONFIRMED","CHECKED_IN"]},checkIn:{lt:checkOut},checkOut:{gt:checkIn}}});
    if(overlap)return{success:false as const,error:"That room is already reserved for part of those dates."};

    // Dates already sold on a connected OTA (Booking.com, Airbnb, ...) are just as taken.
    const channelOverlap=await findChannelBlockOverlap(tx,room.id,checkIn,checkOut);
    if(channelOverlap)return{success:false as const,error:`That room is already booked on ${channelOverlap.connection?.provider?.replace(/_/g," ").toLowerCase()??"a connected channel"} for part of those dates.`};

    // The same physical room sold through the online storefront (or the staff calendar) is taken too.
    if(room.serviceUnitId){
     const online=await findBookingOverlapForUnit(tx,room.serviceUnitId,checkIn,checkOut);
     if(online)return{success:false as const,error:"That room is already booked online for part of those dates."};
    }

    const row=await tx.propertyReservation.create({data:{storeId:a.store.id,guestId:guest.id,roomId:room.id,checkIn,checkOut,status:"CONFIRMED",notes:input.notes?.trim()||null}});
    if(room.status==="AVAILABLE") await tx.propertyRoom.update({where:{id:room.id},data:{status:"RESERVED"}});
    return{success:true as const,data:{id:row.id}};
   },{isolationLevel:"Serializable"});
  }catch(err){
   const serializationFailure=err instanceof Prisma.PrismaClientKnownRequestError&&(err.code==="P2034"||err.meta?.code==="40001");
   if(!serializationFailure)throw err;
   if(attempt===3)return{success:false,error:"That room was just taken. Please pick other dates or try again."};
  }
 }
 if(!result)return{success:false,error:"That room was just taken. Please pick other dates or try again."};

 if(!result.success)return result;
 await notifyRoomChanged(room.id);
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

 if(r.room.status==="OUT_OF_SERVICE")return{success:false,error:"This room is out of service. Move the guest to another room first."};
 const occupant=await prisma.propertyReservation.findFirst({where:{roomId:r.roomId,status:"CHECKED_IN",NOT:{id}},include:{guest:true}});
 if(occupant)return{success:false,error:`${occupant.guest.fullName} is still checked in to this room. Check them out first.`};

 const now=new Date();
 // Same-day early arrival is normal for hotels, so allow check-in from the
 // start of the reservation's check-in calendar day onward — just not
 // before that day at all.
 const checkInDayStart=new Date(r.checkIn.getFullYear(),r.checkIn.getMonth(),r.checkIn.getDate());
 if(now<checkInDayStart)return{success:false,error:`This reservation isn't due to check in until ${formatDate(r.checkIn)}.`};
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
  prisma.propertyRoom.update({where:{id:r.roomId},data:{status:"DIRTY"}}),
  prisma.roomAccessCard.updateMany({where:{storeId:a.store.id,reservationId:id,status:"ACTIVE"},data:{status:"REVOKED",revokedAt:new Date(),revokedReason:"Reservation checked out"}}),
 ]);
 await notifyRoomChanged(r.roomId);
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
 if(await reconcileReservationPaymentState(r.id)==="PENDING")return{success:false,error:"This reservation has a payment in progress. Wait for the payment result before cancelling it."};
 const trimmedReason=reason?.trim();
 await prisma.$transaction(async(tx)=>{
  await tx.propertyReservation.update({where:{id},data:{
   status:"CANCELLED",
   cancelledAt:new Date(),
   notes:trimmedReason?`${r.notes?`${r.notes}\n`:""}Cancelled: ${trimmedReason}`:r.notes,
  }});
  await releaseRoomIfNoOtherStay(tx,r.roomId,id);
  await tx.roomAccessCard.updateMany({where:{storeId:a.store.id,reservationId:id,status:"ACTIVE"},data:{status:"REVOKED",revokedAt:new Date(),revokedReason:"Reservation cancelled"}});
 });
 await notifyRoomChanged(r.roomId);
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
 if(await reconcileReservationPaymentState(r.id)==="PENDING")return{success:false,error:"This reservation has a payment in progress. Wait for the payment result before marking it as a no-show."};
 await prisma.$transaction(async(tx)=>{
  await tx.propertyReservation.update({where:{id},data:{status:"NO_SHOW",cancelledAt:new Date()}});
  await releaseRoomIfNoOtherStay(tx,r.roomId,id);
  await tx.roomAccessCard.updateMany({where:{storeId:a.store.id,reservationId:id,status:"ACTIVE"},data:{status:"REVOKED",revokedAt:new Date(),revokedReason:"Reservation marked no-show"}});
 });
 await notifyRoomChanged(r.roomId);
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
 if(await reconcileReservationPaymentState(reservation.id)==="PENDING")return{success:false,error:"A payment is already in progress for this reservation."};
 if(!["PENDING","CONFIRMED","CHECKED_IN"].includes(reservation.status))return{success:false,error:"Cannot charge a cancelled, no-show, or checked-out reservation."};

 // Bank transfer to the vendor's own account unless the store has added its own gateway keys.
 const route=await resolvePayRoute(a.store.id);
 if(route.mode==="error")return{success:false,error:route.error};
 if(route.mode==="manual"){
  const{payUrl}=await startManualTransfer({store:a.store,purpose:"PMS_RESERVATION",entityId:reservation.id,amount:amountNaira,currency:"NGN",reservationId:reservation.id});
  await prisma.propertyReservation.update({where:{id:reservation.id},data:{paymentStatus:"PENDING",depositAmount:amountNaira,paymentCurrency:"NGN"}});
  revalidatePath(`/store/${slug}/admin/pms`);
  return{success:true,data:{authorizationUrl:payUrl}};
 }

 const checkoutGateway=await resolveCheckoutGateway(a.store.id);
 if(!checkoutGateway.ok)return{success:false,error:checkoutGateway.error};
 const gateway=checkoutGateway.gateway;

 const reference=`RES-${reservation.id}-${shortToken()}`;
 const callbackUrl=paymentCallbackUrl(gateway);
 const currency="NGN";

 await createPendingPayment({
  storeId:a.store.id, reservationId:reservation.id, purpose:"PMS_RESERVATION",
  provider:gateway, reference, amount:amountNaira, currency, usesStoreGateway:checkoutGateway.usesStoreGateway,
 });

 const charge=await chargeCustomer({
  email:guestEmail?.trim()||reservation.guest.email||"guest@biznest.space",
  customerName:reservation.guest.fullName,
  amountNaira,
  reference,
  callbackUrl,
  storeId:a.store.id,
  paystackSubaccountCode:a.store.paystackSubaccountCode,
  flutterwaveSubaccountId:a.store.flutterwaveSubaccountId,
 });

 if(!charge.success){ await markPaymentFailed(reference); return{success:false,error:charge.error}; }

 await prisma.$transaction([
  prisma.propertyReservation.update({where:{id:reservation.id},data:{paymentStatus:"PENDING",depositAmount:amountNaira,paymentCurrency:currency}}),
  prisma.payment.update({where:{reference},data:{provider:charge.gateway,splitSubaccountCode:charge.splitSubaccountCode,usesStoreGateway:charge.usesStoreGateway??false}}),
 ]);

 revalidatePath(`/store/${slug}/admin/pms`);
 return{success:true,data:{authorizationUrl:charge.authorizationUrl}};
}

   


/**
 * Links a PMS room to the online room unit that is the same physical room
 * (or unlinks with unitId = null). Once linked, front-desk reservations and
 * OTA blocks make the unit unavailable online, and online bookings block the
 * room here. One-to-one: a unit can only be linked to one room.
 */
export async function linkRoomToUnit(slug:string, roomId:string, unitId:string|null):Promise<ActionResult>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const room=await prisma.propertyRoom.findFirst({where:{id:roomId,storeId:a.store.id}});
 if(!room)return{success:false,error:"Room not found."};
 if(unitId){
  const unit=await prisma.serviceUnit.findFirst({where:{id:unitId,storeId:a.store.id},select:{id:true}});
  if(!unit)return{success:false,error:"That online room unit doesn't belong to this store."};
  const taken=await prisma.propertyRoom.findFirst({where:{serviceUnitId:unitId,NOT:{id:roomId}},select:{name:true}});
  if(taken)return{success:false,error:`That online unit is already linked to room ${taken.name}.`};
 }
 await prisma.propertyRoom.update({where:{id:roomId},data:{serviceUnitId:unitId}});
 revalidatePath(`/store/${slug}/admin/pms`);
 return{success:true,data:undefined};
}

/**
 * Links every PMS room whose name matches exactly one online unit label
 * (case-insensitive, e.g. room "101" and unit "101"). Ambiguous or already
 * linked rooms are left alone. Returns how many were linked.
 */
export async function autoLinkRoomsToUnits(slug:string):Promise<ActionResult<{linked:number}>>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const [rooms,units]=await Promise.all([
  prisma.propertyRoom.findMany({where:{storeId:a.store.id},select:{id:true,name:true,serviceUnitId:true}}),
  prisma.serviceUnit.findMany({where:{storeId:a.store.id},select:{id:true,label:true}}),
 ]);
 const norm=(v:string)=>v.trim().toLowerCase();
 const linkedUnits=new Set(rooms.map(r=>r.serviceUnitId).filter(Boolean) as string[]);
 const roomsByName=new Map<string,typeof rooms>();
 for(const r of rooms){const k=norm(r.name);roomsByName.set(k,[...(roomsByName.get(k)??[]),r])}
 const unitsByLabel=new Map<string,typeof units>();
 for(const u of units){const k=norm(u.label);unitsByLabel.set(k,[...(unitsByLabel.get(k)??[]),u])}
 let linked=0;
 for(const [key,rs] of roomsByName){
  const us=unitsByLabel.get(key)??[];
  if(rs.length!==1||us.length!==1)continue;           // ambiguous: leave for a human
  const [r]=rs,[u]=us;
  if(r.serviceUnitId||linkedUnits.has(u.id))continue;  // already linked
  await prisma.propertyRoom.update({where:{id:r.id},data:{serviceUnitId:u.id}});
  linkedUnits.add(u.id);linked++;
 }
 revalidatePath(`/store/${slug}/admin/pms`);
 return{success:true,data:{linked}};
}


/* -------------------------------------------------------------------------- */
/* MAINTENANCE TICKETS                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Logs a fault against a room. The room is taken out of sale (MAINTENANCE) unless
 * a guest is in it right now or it is already out of service — in those cases the
 * ticket is still recorded, but the guest's room status is left alone.
 */
export async function reportMaintenanceIssue(slug:string,input:{roomId:string;description:string;priority:"LOW"|"MEDIUM"|"HIGH"}):Promise<ActionResult<{id:string}>>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 const description=input.description.trim();
 if(!description)return{success:false,error:"Describe the problem."};
 if(description.length>2000)return{success:false,error:"Description is too long (max 2000 characters)."};
 if(!["LOW","MEDIUM","HIGH"].includes(input.priority))return{success:false,error:"Choose a priority."};
 const room=await prisma.propertyRoom.findFirst({where:{id:input.roomId,storeId:a.store.id}});
 if(!room)return{success:false,error:"Room not found."};
 const session=await auth();
 const ticket=await prisma.$transaction(async(tx)=>{
  const t=await tx.propertyMaintenanceTicket.create({data:{storeId:a.store.id,roomId:room.id,description,priority:input.priority,reportedById:session?.user?.id??null},select:{id:true}});
  const occupied=await tx.propertyReservation.findFirst({where:{roomId:room.id,status:"CHECKED_IN"},select:{id:true}});
  if(!occupied&&room.status!=="OUT_OF_SERVICE")await tx.propertyRoom.update({where:{id:room.id},data:{status:"MAINTENANCE"}});
  return t;
 });
 revalidatePath(`/store/${slug}/admin/pms`);
 return{success:true,data:{id:ticket.id}};
}

/**
 * Closes a ticket. The room only returns to service when its LAST open ticket is
 * resolved and it is still sitting in MAINTENANCE; `nextStatus` says whether it
 * then needs cleaning first or is ready to sell.
 */
export async function resolveMaintenanceTicket(slug:string,ticketId:string,nextStatus:"AVAILABLE"|"DIRTY",resolution?:string):Promise<ActionResult>{
 const a=await access(slug);if(!a.success)return{success:false,error:a.error};
 if(!["AVAILABLE","DIRTY"].includes(nextStatus))return{success:false,error:"Invalid room status."};
 const ticket=await prisma.propertyMaintenanceTicket.findFirst({where:{id:ticketId,storeId:a.store.id}});
 if(!ticket)return{success:false,error:"Ticket not found."};
 if(ticket.status==="RESOLVED")return{success:true,data:undefined};
 await prisma.$transaction(async(tx)=>{
  await tx.propertyMaintenanceTicket.update({where:{id:ticket.id},data:{status:"RESOLVED",resolvedAt:new Date(),resolution:resolution?.trim()||null}});
  const stillOpen=await tx.propertyMaintenanceTicket.count({where:{roomId:ticket.roomId,status:"OPEN"}});
  if(stillOpen===0)await tx.propertyRoom.updateMany({where:{id:ticket.roomId,status:"MAINTENANCE"},data:{status:nextStatus}});
 });
 revalidatePath(`/store/${slug}/admin/pms`);
 return{success:true,data:undefined};
}
