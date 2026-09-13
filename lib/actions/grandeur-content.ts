"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";
import type { GrandeurEventsContent, GrandeurGalleryContent } from "@/lib/grandeur-content";
import { getGrandeurEvents, getGrandeurGallery } from "@/lib/grandeur-content";

async function access(slug:string){return assertStorePermission(slug,"settings");}
export async function saveGrandeurEvents(slug:string,content:GrandeurEventsContent):Promise<ActionResult>{const a=await access(slug);if(!a.success)return a; await prisma.storePage.upsert({where:{storeId_slug:{storeId:a.store.id,slug:"events"}},update:{title:"Events",content,isPublished:true},create:{storeId:a.store.id,slug:"events",title:"Events",content,isPublished:true}});revalidatePath(`/store/${slug}/events`);revalidatePath(`/store/${slug}/admin/events`);return {success:true,data:undefined};}
export async function saveGrandeurGallery(slug:string,content:GrandeurGalleryContent):Promise<ActionResult>{const a=await access(slug);if(!a.success)return a; await prisma.storePage.upsert({where:{storeId_slug:{storeId:a.store.id,slug:"gallery"}},update:{title:"Gallery",content,isPublished:true},create:{storeId:a.store.id,slug:"gallery",title:"Gallery",content,isPublished:true}});revalidatePath(`/store/${slug}/gallery`);revalidatePath(`/store/${slug}/admin/gallery`);return {success:true,data:undefined};}
export async function getGrandeurAdminContent(slug:string){return {events:await getGrandeurEvents(slug),gallery:await getGrandeurGallery(slug)};}
