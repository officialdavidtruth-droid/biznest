"use server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";
import { TASTEHOUSE_TEMPLATE_NAME } from "@/lib/tastehouse-content";

export async function saveTasteHouseContent(slug:string, content:Record<string,unknown>):Promise<ActionResult>{
 const a=await assertStorePermission(slug,"settings"); if(!a.success)return a;
 const jsonContent=content as Prisma.InputJsonValue;
 await prisma.storePage.upsert({where:{storeId_slug:{storeId:a.store.id,slug:"tastehouse-home"}},update:{title:"TasteHouse Homepage",content:jsonContent,isPublished:true},create:{storeId:a.store.id,slug:"tastehouse-home",title:"TasteHouse Homepage",content:jsonContent,isPublished:true}});
 revalidatePath(`/store/${slug}`); revalidatePath(`/store/${slug}/admin/tastehouse`); return {success:true,data:undefined};
}
export async function ensureTasteHouseTemplate(slug:string){
 const a=await assertStorePermission(slug,"settings"); if(!a.success)return a;
 const template=await prisma.storeTemplate.findUnique({where:{name:TASTEHOUSE_TEMPLATE_NAME},select:{id:true}}); if(template) await prisma.store.update({where:{id:a.store.id},data:{templateId:template.id}});
 revalidatePath(`/store/${slug}`); return {success:true,data:undefined};
}