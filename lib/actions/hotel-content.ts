"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";
export async function saveHotelSection(slug:string,section:string,content:unknown):Promise<ActionResult>{const a=await assertStorePermission(slug,"settings");if(!a.success)return a;const allowed=new Set(["hotel-home","hotel-rooms","hotel-offers","hotel-gallery","hotel-events","hotel-amenities","hotel-contact"]);if(!allowed.has(section))return {success:false,error:"Invalid hotel section."};await prisma.storePage.upsert({where:{storeId_slug:{storeId:a.store.id,slug:section}},update:{title:section.replace("hotel-",""),content:content as any,isPublished:true},create:{storeId:a.store.id,slug:section,title:section.replace("hotel-",""),content:content as any,isPublished:true}});revalidatePath(`/store/${slug}`);revalidatePath(`/store/${slug}/${section.replace("hotel-","")}`);revalidatePath(`/store/${slug}/admin/hotel`);return {success:true,data:undefined};}
