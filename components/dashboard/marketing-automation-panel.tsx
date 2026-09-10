"use client";
import { useTransition } from "react";
import { ArrowRight, CheckCircle2, Mail, ShoppingCart, UserPlus, Workflow, Zap } from "lucide-react";
import { createAutomation } from "@/lib/actions/business-platform";

const presets=[
 {name:"New subscriber welcome",description:"Send a welcome email when a new newsletter subscriber joins.",trigger:"NEWSLETTER_SUBSCRIBER_CREATED",actions:[{type:"EMAIL",template:"welcome"}],icon:UserPlus},
 {name:"Lead follow-up",description:"Create a follow-up task when a new CRM lead enters the pipeline.",trigger:"CRM_LEAD_CREATED",actions:[{type:"NOTIFY_STAFF",message:"New lead needs follow-up."}],icon:Zap},
 {name:"Abandoned checkout",description:"Start a recovery workflow when a checkout is abandoned.",trigger:"CHECKOUT_ABANDONED",actions:[{type:"EMAIL",template:"abandoned-checkout"}],icon:ShoppingCart},
 {name:"Post-purchase thank you",description:"Follow up with customers after a successful order.",trigger:"ORDER_COMPLETED",actions:[{type:"EMAIL",template:"thank-you"}],icon:Mail},
];
export function MarketingAutomationPanel({slug,activeCount}:{slug:string;activeCount:number}){
 const [pending,start]=useTransition();
 const install=(p:typeof presets[number])=>start(async()=>{const r=await createAutomation(slug,{name:p.name,description:p.description,trigger:p.trigger,actions:p.actions});if("error" in r)alert(r.error||"Could not create automation.");else location.reload()});
 return <section className="rounded-3xl border bg-background p-6 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Workflow className="h-4 w-4"/>Marketing automation</div><h2 className="mt-1 text-lg font-bold">Build the follow-up engine</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Turn one-time campaigns into automated customer journeys that run in the background.</p></div><div className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">{activeCount} active workflow{activeCount===1?"":"s"}</div></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{presets.map(p=>{const Icon=p.icon;return <div key={p.name} className="rounded-2xl border p-4 transition hover:border-primary/40 hover:shadow-sm"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-primary"><Icon className="h-4 w-4"/></span><CheckCircle2 className="h-4 w-4 text-muted-foreground"/></div><h3 className="mt-3 text-sm font-semibold">{p.name}</h3><p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{p.description}</p><button disabled={pending} onClick={()=>install(p)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary disabled:opacity-50">Activate workflow <ArrowRight className="h-3.5 w-3.5"/></button></div>})}</div></section>
}
