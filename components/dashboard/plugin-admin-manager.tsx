"use client";

import { useState, useTransition } from "react";
import { updatePluginConfiguration } from "@/lib/actions/plugin-admin";

type Plugin = { id:string; key:string; name:string; description:string; category:string; icon:string|null; price:number; currency:string; billingInterval:"MONTHLY"|"YEARLY"|"ONE_TIME"; isFree:boolean; isComingSoon:boolean; status:"ACTIVE"|"DISABLED"; eligibleBusinessTypes:string[]; supportedPlanIds:string[]; supportedPlans:string[]; installedStores:number };
type Plan = { id:string; name:string; price:number };

export function PluginAdminManager({ plugins, plans }: { plugins: Plugin[]; plans: Plan[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Plugin>>(Object.fromEntries(plugins.map(p => [p.id, p])));
  const update = (id:string, patch:Partial<Plugin>) => setDrafts(prev => ({...prev, [id]: {...prev[id], ...patch}}));
  const save = (id:string) => start(async () => {
    const p=drafts[id];
    const result=await updatePluginConfiguration({pluginId:p.id,price:p.price,isFree:p.isFree,isComingSoon:p.isComingSoon,status:p.status,billingInterval:p.billingInterval,category:p.category,eligibleBusinessTypes:p.eligibleBusinessTypes,planIds:p.supportedPlanIds});
    setMessage(result.success ? `${p.name} updated.` : result.error);
  });
  const togglePlan=(p:Plugin, id:string)=>update(p.id,{supportedPlanIds:p.supportedPlanIds.includes(id)?p.supportedPlanIds.filter(x=>x!==id):[...p.supportedPlanIds,id]});
  return <div className="space-y-4">
    {message && <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">{message}</div>}
    {plugins.map(original=>{const p=drafts[original.id]; return <div key={p.id} className="rounded-2xl border border-white/10 bg-[#10261b] p-5 text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start"><div><div className="flex items-center gap-2"><h2 className="font-bold text-white">{p.name}</h2><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold text-emerald-200">{p.key}</span></div><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-200">{p.description}</p><p className="mt-2 text-[10px] text-slate-300">{p.installedStores} store{p.installedStores===1?"":"s"} installed</p></div><button disabled={pending} onClick={()=>save(p.id)} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Save configuration</button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold text-slate-100">Price<input type="number" min="0" className="mt-1 w-full rounded-xl border border-white/15 bg-[#0b1c14] px-3 py-2 text-sm text-white placeholder:text-slate-400" value={p.price} disabled={p.isFree} onChange={e=>update(p.id,{price:Number(e.target.value)})}/></label>
        <label className="text-xs font-semibold text-slate-100">Billing<select className="mt-1 w-full rounded-xl border border-white/15 bg-[#0b1c14] px-3 py-2 text-sm text-white placeholder:text-slate-400" value={p.billingInterval} onChange={e=>update(p.id,{billingInterval:e.target.value as Plugin["billingInterval"]})}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option><option value="ONE_TIME">One time</option></select></label>
        <label className="text-xs font-semibold text-slate-100">Category<input className="mt-1 w-full rounded-xl border border-white/15 bg-[#0b1c14] px-3 py-2 text-sm text-white placeholder:text-slate-400" value={p.category} onChange={e=>update(p.id,{category:e.target.value})}/></label>
        <label className="text-xs font-semibold text-slate-100">Eligible business types<input className="mt-1 w-full rounded-xl border border-white/15 bg-[#0b1c14] px-3 py-2 text-sm text-white placeholder:text-slate-400" value={p.eligibleBusinessTypes.join(", ")} onChange={e=>update(p.id,{eligibleBusinessTypes:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-100"><label className="flex items-center gap-2"><input type="checkbox" checked={p.isFree} onChange={e=>update(p.id,{isFree:e.target.checked,price:e.target.checked?0:p.price})}/> Free / included</label><label className="flex items-center gap-2"><input type="checkbox" checked={p.isComingSoon} onChange={e=>update(p.id,{isComingSoon:e.target.checked})}/> Coming soon</label><label className="flex items-center gap-2"><input type="checkbox" checked={p.status==="ACTIVE"} onChange={e=>update(p.id,{status:e.target.checked?"ACTIVE":"DISABLED"})}/> Active</label></div>
      <div className="mt-5 border-t border-white/10 pt-4"><p className="mb-2 text-xs font-bold text-white">Plans that can use this app</p><div className="flex flex-wrap gap-2">{plans.map(plan=><button key={plan.id} type="button" onClick={()=>togglePlan(p,plan.id)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${p.supportedPlanIds.includes(plan.id)?"border-primary bg-primary/10 text-primary":"text-slate-300"}`}>{p.supportedPlanIds.includes(plan.id)?"✓ ":""}{plan.name}</button>)}</div></div>
    </div>})}
  </div>;
}
