import Link from "next/link";
import { ArrowRight, BarChart3, Boxes, ClipboardCheck, FileText, ShoppingCart, Users } from "lucide-react";

export function PluginWorkspace({ slug, data }: { slug: string; data: Awaited<ReturnType<import("@/lib/actions/plugin-workspaces").getPluginWorkspace>> & { error?: string } }) {
  if ("error" in data || !data.plugin) return null;
  const m = data.metrics;
  const cards = [
    ["Leads", m.leads, Users], ["Team", m.staff, Users], ["Suppliers", m.suppliers, Boxes], ["Purchase orders", m.purchaseOrders, ShoppingCart],
    ["Pending approvals", m.pendingApprovals, ClipboardCheck], ["Documents", m.documents, FileText], ["Assets", m.assets, Boxes], ["Conversations", m.conversations, FileText],
  ] as const;
  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest App</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{data.plugin.name}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{data.plugin.description}</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,Icon])=><div key={label} className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary"/></div><p className="mt-2 text-xl font-bold">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">Live from your BizNest workspace</p></div>)}</div>
    <section className="rounded-2xl border bg-background p-5 shadow-sm"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary"/><h2 className="text-sm font-bold">Operational controls</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.actions.map(a=><Link key={a.href} href={`/store/${slug}/admin${a.href}`} className="group rounded-xl border p-4 hover:border-primary/40"><p className="text-sm font-bold">{a.label}</p><span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"/></span></Link>)}</div></section>
    {data.purchaseOrders.length>0&&<section className="overflow-hidden rounded-2xl border bg-background"><div className="border-b px-5 py-4"><h2 className="text-sm font-bold">Recent purchasing</h2></div><div className="divide-y">{data.purchaseOrders.map(p=><div key={p.id} className="flex items-center gap-4 px-5 py-3 text-xs"><span className="font-semibold">{p.poNumber}</span><span className="text-muted-foreground">{p.supplier.name}</span><span className="ml-auto font-bold">{p.currency} {p.subtotal.toLocaleString()}</span><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold">{p.status.replace("_"," ")}</span></div>)}</div></section>}
  </div>;
}
