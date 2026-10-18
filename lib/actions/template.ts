"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { seedSampleListings } from "@/lib/actions/store";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getTemplateDefinition, isTemplateCompatibleWithBusiness } from "@/lib/template-registry";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import type { ActionResult } from "@/types/actions";
import { Prisma } from "@prisma/client";

export async function setStoreTemplate(slug:string,templateId:string):Promise<ActionResult>{
 const access=await assertStorePermission(slug,"settings");if(!access.success)return access;
 const store=await prisma.store.findUnique({where:{id:access.store.id},include:{business:true,subscription:true}});if(!store)return {success:false,error:"Store not found."};
 let templateDef=getTemplateDefinition(templateId);
 if(!templateDef){const row=await prisma.storeTemplate.findUnique({where:{id:templateId},select:{name:true}});if(row)templateDef=getTemplateDefinition(row.name);}
 if(!templateDef)return {success:false,error:"Template not found."};
 let template=await prisma.storeTemplate.findUnique({where:{name:templateDef.name}});
 if(!template){template=await prisma.storeTemplate.create({data:{name:templateDef.name,category:templateDef.category,tierRank:templateDef.theme.tierRank,isActive:true,config:templateDef.theme as unknown as Prisma.InputJsonValue}});}
 if(!template.isActive)return {success:false,error:"That template is currently unavailable."};
 const businessType=getCanonicalBusinessType({businessCategory:store.business.category,storeBusinessType:store.businessType});
 if(!isTemplateCompatibleWithBusiness(templateDef,businessType))return {success:false,error:`${template.name} is not compatible with this business.`};
 const planRank=Number((store.subscription?.features as {templateTier?:number}|null)?.templateTier??1);
 if(template.tierRank>planRank)return {success:false,error:"This template requires a higher plan."};
 // A saved Website Builder draft (sectionOverrides.builder) is rendered INSTEAD of the
 // template for builder-based templates (see storefront-runtime.tsx). The AI store
 // builder and the visual builder both write one, so without this every template the
 // owner picked afterwards kept showing the same old layout. Switching templates
 // therefore drops the draft (and its order/hidden lists) so the new template shows;
 // all other overrides (faq, delivery note, social bio, template content) are kept.
 // Same for themeColors / fontFamily: resolveStoreTheme() lays them over EVERY template
 // (secondary->background, primary->accent, font), and onboarding / the AI builder set
 // them, so every template came out in the same colours and font. A new template starts
 // with its own palette and typography; the owner can re-customise afterwards.
 const changed=store.templateId!==template.id;
 let sectionOverrides:Prisma.InputJsonValue|undefined;
 if(changed&&store.sectionOverrides&&typeof store.sectionOverrides==="object"&&!Array.isArray(store.sectionOverrides)){
  const {builderVersion:_v,builder:_b,order:_o,hidden:_h,...rest}=store.sectionOverrides as Record<string,unknown>;
  void _v;void _b;void _o;void _h;
  sectionOverrides=rest as Prisma.InputJsonValue;
 }
 await prisma.store.update({where:{id:store.id},data:{templateId:template.id,businessType:businessType,...(changed?{themeColors:Prisma.DbNull,fontFamily:null}:{}),...(sectionOverrides!==undefined?{sectionOverrides}:{})}});
 if(templateDef.renderer==="grandeur")await seedSampleListings(slug);
 revalidatePath(`/store/${slug}`);revalidatePath(`/store/${slug}/admin/templates`);revalidatePath(`/store/${slug}/admin/customize`);return {success:true,data:undefined};
}