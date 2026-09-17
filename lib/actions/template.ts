"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { seedSampleListings } from "@/lib/actions/store";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getTemplateDefinition, isTemplateCompatibleWithBusiness } from "@/lib/template-registry";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import type { ActionResult } from "@/types/actions";
import type { Prisma } from "@prisma/client";

export async function setStoreTemplate(slug:string,templateId:string):Promise<ActionResult>{
 const access=await assertStorePermission(slug,"settings");if(!access.success)return access;
 const store=await prisma.store.findUnique({where:{id:access.store.id},include:{business:true,subscription:true}});if(!store)return {success:false,error:"Store not found."};
 const templateDef=getTemplateDefinition(templateId);if(!templateDef)return {success:false,error:"Template not found."};
 let template=await prisma.storeTemplate.findUnique({where:{name:templateDef.name}});
 if(!template){template=await prisma.storeTemplate.create({data:{name:templateDef.name,category:templateDef.category,tierRank:templateDef.theme.tierRank,isActive:true,config:templateDef.theme as unknown as Prisma.InputJsonValue}});}
 if(!template.isActive)return {success:false,error:"That template is currently unavailable."};
 const businessType=getCanonicalBusinessType({businessCategory:store.business.category,storeBusinessType:store.businessType});
 if(!isTemplateCompatibleWithBusiness(templateDef,businessType))return {success:false,error:`${template.name} is not compatible with this business.`};
 const planRank=Number((store.subscription?.features as {templateTier?:number}|null)?.templateTier??1);
 if(template.tierRank>planRank)return {success:false,error:"This template requires a higher plan."};
 await prisma.store.update({where:{id:store.id},data:{templateId:template.id,businessType:businessType}});
 if(templateDef.renderer==="grandeur")await seedSampleListings(slug);
 revalidatePath(`/store/${slug}`);revalidatePath(`/store/${slug}/admin/templates`);revalidatePath(`/store/${slug}/admin/customize`);return {success:true,data:undefined};
}
