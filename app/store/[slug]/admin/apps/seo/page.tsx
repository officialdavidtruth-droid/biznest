import { Search, Sparkles, BarChart3, Globe2 } from "lucide-react";
import Link from "next/link";
import { getPluginEntitlement } from "@/lib/plugins";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { SeoWorkspace } from "@/components/dashboard/seo-workspace";

export default async function SEOPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params; const access=await assertStorePermission(slug,"settings"); if(!access.success)return null;
 const entitlement=await getPluginEntitlement(access.store.id,"seo");
 if(!entitlement.allowed||!entitlement.installed)return <div className="rounded-3xl border bg-background p-10 text-center"><Search className="mx-auto h-10 w-10 text-primary"/><h1 className="mt-4 text-xl font-bold">SEO & Search</h1><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Install the SEO app to manage search visibility and website metadata.</p><Link href={`/store/${slug}/admin/apps`} className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Open Apps</Link></div>;
 const store=access.store;
 return <div className="space-y-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Sparkles className="h-3.5 w-3.5"/>BizNest App</div><h1 className="mt-1 text-3xl font-bold tracking-tight">SEO & Search</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Give every BizNest website a strong technical and local-search foundation before worrying about rankings.</p></div><div className="flex gap-2"><Link href={`/store/${slug}/admin/analytics`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold"><BarChart3 className="h-4 w-4"/>Analytics</Link><Link href={`/store/${slug}`} target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><Globe2 className="h-4 w-4"/>View website</Link></div></div><SeoWorkspace slug={slug} initial={{name:store.name,seoTitle:store.seoTitle??`${store.name} | ${store.businessType}`,seoDescription:store.seoDescription??store.business.description,seoKeywords:"",seoCanonicalUrl:store.seoCanonicalUrl??"",seoOgImage:store.seoOgImage??store.bannerUrl??"",seoNoIndex:store.seoNoIndex,seoGoogleVerification:store.seoGoogleVerification??""}}/></div>
}
