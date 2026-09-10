"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { revalidatePath } from "next/cache";

const clean = (v: string | undefined | null) => v?.trim() || null;

export async function getCrmDashboard(slug: string) {
  const access = await assertStorePermission(slug, "customers");
  if (!access.success) return { success: false as const, error: access.error };
  const storeId = access.store.id;
  const [leads, customers, won, pipeline] = await Promise.all([
    prisma.crmLead.findMany({
      where: { storeId }, orderBy: { updatedAt: "desc" }, take: 100,
      select: { id:true,name:true,email:true,phone:true,company:true,source:true,status:true,value:true,currency:true,notes:true,lastContactedAt:true,nextFollowUpAt:true,createdAt:true,updatedAt:true,
        activities:{orderBy:{createdAt:"desc"},take:5,select:{id:true,type:true,title:true,body:true,createdAt:true}} }
    }),
    prisma.storeCustomerProfile.count({ where: { storeId } }),
    prisma.crmLead.aggregate({ where:{storeId,status:"WON"}, _sum:{value:true}, _count:{_all:true} }),
    prisma.crmLead.groupBy({ where:{storeId}, by:["status"], _count:{_all:true}, _sum:{value:true} }),
  ]);
  const safeLeads = leads.map((lead) => ({ ...lead, value: lead.value === null ? null : Number(lead.value) }));
  return { success:true as const, data:{ leads: safeLeads, customerCount:customers, wonCount:won._count._all, wonValue:Number(won._sum.value ?? 0), pipeline } };
}

export async function createCrmLead(slug:string, input:{name:string;email?:string;phone?:string;company?:string;source?:string;value?:number;notes?:string;nextFollowUpAt?:string}) {
  const access=await assertStorePermission(slug,"customers"); if(!access.success) return access;
  if(!input.name.trim()) return {success:false,error:"Lead name is required."};
  const allowed=["WEBSITE","FORM","WHATSAPP","EMAIL","PHONE","BOOKING","ORDER","REFERRAL","SOCIAL","MANUAL","OTHER"];
  const source=(input.source && allowed.includes(input.source)?input.source:"MANUAL") as any;
  const lead=await prisma.crmLead.create({data:{storeId:access.store.id,name:input.name.trim(),email:clean(input.email),phone:clean(input.phone),company:clean(input.company),source,value:typeof input.value==="number"&&input.value>=0?input.value:undefined,notes:clean(input.notes),nextFollowUpAt:input.nextFollowUpAt?new Date(input.nextFollowUpAt):undefined}});
  revalidatePath(`/store/${slug}/admin/apps/crm`);
  return {success:true,data:lead};
}

export async function updateCrmLeadStatus(slug:string,id:string,status:string){
  const access=await assertStorePermission(slug,"customers"); if(!access.success) return access;
  const allowed=["NEW","CONTACTED","QUALIFIED","PROPOSAL","WON","LOST"];
  if(!allowed.includes(status)) return {success:false,error:"Invalid lead status."};
  const result=await prisma.crmLead.updateMany({where:{id,storeId:access.store.id},data:{status:status as any}});
  if(!result.count) return {success:false,error:"Lead not found."};
  revalidatePath(`/store/${slug}/admin/apps/crm`);
  return {success:true};
}

export async function addCrmActivity(slug:string,id:string,input:{type:string;title:string;body?:string}){
  const access=await assertStorePermission(slug,"customers"); if(!access.success) return access;
  const lead=await prisma.crmLead.findFirst({where:{id,storeId:access.store.id},select:{id:true}});
  if(!lead) return {success:false,error:"Lead not found."};
  const activity=await prisma.crmActivity.create({data:{leadId:id,type:input.type.trim().slice(0,40),title:input.title.trim().slice(0,180),body:clean(input.body)}});
  await prisma.crmLead.update({where:{id},data:{lastContactedAt:new Date()}});
  revalidatePath(`/store/${slug}/admin/apps/crm`);
  return {success:true,data:activity};
}

export async function saveStoreSeo(slug:string,input:{title:string;description:string;keywords?:string;canonicalUrl?:string;ogImage?:string;noIndex:boolean;googleVerification?:string}){
  const access=await assertStorePermission(slug,"settings"); if(!access.success) return access;
  const title=input.title.trim().slice(0,180), description=input.description.trim().slice(0,320);
  if(!title || !description) return {success:false,error:"SEO title and description are required."};
  const url=(input.canonicalUrl||"").trim();
  if(url && !/^https:\/\//i.test(url)) return {success:false,error:"Canonical URL must use HTTPS."};
  await prisma.store.update({where:{id:access.store.id},data:{seoTitle:title,seoDescription:description,seoKeywords:clean(input.keywords)?.slice(0,500),seoCanonicalUrl:clean(url),seoOgImage:clean(input.ogImage),seoNoIndex:input.noIndex,seoGoogleVerification:clean(input.googleVerification)}});
  revalidatePath(`/store/${slug}/admin/apps/seo`);
  revalidatePath(`/store/${slug}`);
  return {success:true};
}
