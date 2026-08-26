"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";

async function access(slug: string) {
  const a = await assertStorePermission(slug, "orders");
  if (!a.success) return a;
  if (a.store.business.category !== "Hotel & Lodging") return { success: false as const, error: "PMS is only available to property businesses." };
  return a;
}

export async function getPmsData(slug: string) {
  const a = await access(slug); if (!a.success) return null;
  const [rooms, guests, reservations] = await Promise.all([
    prisma.propertyRoom.findMany({ where: { storeId: a.store.id }, orderBy: { name: "asc" } }),
    prisma.propertyGuest.findMany({ where: { storeId: a.store.id }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.propertyReservation.findMany({ where: { storeId: a.store.id }, include: { guest: true, room: true }, orderBy: { checkIn: "asc" }, take: 100 }),
  ]);
  return { rooms, guests, reservations };
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
 const [guest,room,overlap]=await Promise.all([
  prisma.propertyGuest.findFirst({where:{id:input.guestId,storeId:a.store.id}}),
  prisma.propertyRoom.findFirst({where:{id:input.roomId,storeId:a.store.id}}),
  prisma.propertyReservation.findFirst({where:{storeId:a.store.id,roomId:input.roomId,status:{in:["PENDING","CONFIRMED","CHECKED_IN"]},checkIn:{lt:checkOut},checkOut:{gt:checkIn}}})
 ]);
 if(!guest||!room)return{success:false,error:"Guest or room does not belong to this store."};
 if(overlap)return{success:false,error:"That room is already reserved for part of those dates."};
 const row=await prisma.propertyReservation.create({data:{storeId:a.store.id,guestId:guest.id,roomId:room.id,checkIn,checkOut,status:"CONFIRMED",notes:input.notes?.trim()||null}});
 if(room.status==="AVAILABLE") await prisma.propertyRoom.update({where:{id:room.id},data:{status:"RESERVED"}});
 revalidatePath(`/store/${slug}/admin/pms`);return{success:true,data:{id:row.id}};
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
