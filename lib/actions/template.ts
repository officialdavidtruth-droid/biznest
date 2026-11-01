"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { seedSampleListings } from "@/lib/actions/store";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getTemplateDefinition, PUBLIC_TEMPLATE_REGISTRY } from "@/lib/template-registry";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import type { ActionResult } from "@/types/actions";
import { Prisma } from "@prisma/client";

export async function setStoreTemplate(slug:string,templateId:string):Promise<ActionResult>{
 const access=await assertStorePermission(slug,"settings");if(!access.success)return access;
 const store=await prisma.store.findUnique({where:{id:access.store.id},include:{business:true,subscription:true,template:true}});if(!store)return {success:false,error:"Store not found."};
 let templateDef=getTemplateDefinition(templateId);
 if(!templateDef){const row=await prisma.storeTemplate.findUnique({where:{id:templateId},select:{name:true}});if(row)templateDef=getTemplateDefinition(row.name);}
 if(!templateDef)return {success:false,error:"Template not found."};
 // Compatibility templates (Grandeur, Veloura, TasteHouse, Example) are retired: the gallery only shows
 // one to a store already using it, so enforce the same rule here -- otherwise anyone could apply a
 // retired design by calling this action with its id.
 const isPublic=PUBLIC_TEMPLATE_REGISTRY.some(d=>d.name===templateDef!.name);
 if(!isPublic&&store.template?.name!==templateDef.name)return {success:false,error:"That template is no longer available."};
 let template=await prisma.storeTemplate.findUnique({where:{name:templateDef.name}});
 if(!template){template=await prisma.storeTemplate.create({data:{name:templateDef.name,category:templateDef.category,tierRank:templateDef.theme.tierRank,isActive:true,config:templateDef.theme as unknown as Prisma.InputJsonValue}});}
 if(!template.isActive)return {success:false,error:"That template is currently unavailable."};
 const businessType=getCanonicalBusinessType({businessCategory:store.business.category,storeBusinessType:store.businessType});
 // Niche never blocks a template: any business may use any template (niche only affects gallery ranking).
 const planRank=Number((store.subscription?.features as {templateTier?:number}|null)?.templateTier??1);
 // The code registry is the source of truth for a template's tier. The StoreTemplate row's tierRank is only a
 // copy refreshed by prisma/seed.ts, so it can be stale; gate on the registry and heal the row.
 const requiredTier=Number(templateDef.theme.tierRank??template.tierRank??1);
 if(requiredTier>planRank)return {success:false,error:"This template requires a higher plan."};
 if(template.tierRank!==requiredTier){template=await prisma.storeTemplate.update({where:{id:template.id},data:{tierRank:requiredTier}});}
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
  const {builderVersion:_v,builder:_b,order:_o,hidden:_h,templateArrangement:_a,...rest}=store.sectionOverrides as Record<string,unknown>;
  void _v;void _b;void _o;void _h;void _a;
  sectionOverrides=rest as Prisma.InputJsonValue;
 }
 await prisma.store.update({where:{id:store.id},data:{templateId:template.id,businessType:businessType,...(changed?{themeColors:Prisma.DbNull,fontFamily:null}:{}),...(sectionOverrides!==undefined?{sectionOverrides}:{})}});
 if(templateDef.renderer==="grandeur")await seedSampleListings(slug);
 revalidatePath(`/store/${slug}`);revalidatePath(`/store/${slug}/admin/templates`);revalidatePath(`/store/${slug}/admin/customize`);return {success:true,data:undefined};
}