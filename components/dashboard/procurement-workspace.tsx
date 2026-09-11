import Link from "next/link";
import { Boxes, ClipboardCheck, FileText, Plus, ReceiptText, Truck, Wallet } from "lucide-react";

export type ProcurementData = {
  plugin: { name: string; description: string };
  summary: {
    suppliers: number;
    activeSuppliers: number;
    openPOs: number;
    pendingFinancialApprovals: number;
    requisitions: number;
    awaitingReceiving: number;
    spend30: number;
    overdueDeliveries: number;
  };
  requisitions: { id: string; number: string; title: string; department: string | null; requesterName: string | null; priority: string; status: string; neededBy: string | null; estimate: number }[];
  purchaseOrders: { id: string; poNumber: string; supplier: string; status: string; subtotal: number; currency: string; expectedAt: string | null; orderedUnits: number; receivedUnits: number }[];
  suppliers: { id: string; name: string; orders: number; spend: number; openOrders: number; onTimeRate: number | null }[];
};

const money = (n: number, currency = "NGN") => `${currency === "NGN" ? "₦" : currency + " "}${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
const statusClass: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-500/10 text-blue-700",
  PARTIALLY_RECEIVED: "bg-amber-500/10 text-amber-700",
  RECEIVED: "bg-emerald-500/10 text-emerald-700",
  SUBMITTED: "bg-amber-500/10 text-amber-700",
  APPROVED: "bg-emerald-500/10 text-emerald-700",
};

export function ProcurementWorkspace({ slug, data }: { slug: string; data: ProcurementData }) {
  const base = `/store/${slug}/admin`;
  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest Procurement</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Procurement & Vendors</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Control purchasing from supplier discovery through requisition, financial approval, purchase order and receiving.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/suppliers/new`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"><Plus className="h-3.5 w-3.5" /> Supplier</Link>
          <Link href={`${base}/purchase-orders/new`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Purchase order</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Spend · 30 days", money(data.summary.spend30), Wallet],
          ["Open purchase orders", data.summary.openPOs, ReceiptText],
          ["Awaiting financial approval", data.summary.pendingFinancialApprovals, ClipboardCheck],
          ["Awaiting receiving", data.summary.awaitingReceiving, Truck],
        ].map(([label, value, Icon]) => <div key={String(label)} className="rounded-xl border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 text-xl font-bold">{value}</p></div>)}
      </div>

      <section className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold">Procurement workflow</h2><p className="mt-1 text-xs text-muted-foreground">One controlled chain instead of disconnected purchasing screens.</p></div><Link href={`${base}/apps/requisition`} className="text-xs font-bold text-primary">Open requisitions</Link></div>
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          {[['1','Request','Requisitions',`${base}/apps/requisition`],['2','Approve','Financial Control',`${base}/apps/financial-control`],['3','Order','Purchase Orders',`${base}/purchase-orders`],['4','Receive','Goods Receiving',`${base}/purchase-orders`],['5','Stock','Inventory',`${base}/inventory`]].map(([n,title,sub,href]) => <Link key={n} href={href} className="rounded-lg border p-3 hover:bg-muted/30"><span className="text-[10px] font-bold text-primary">STEP {n}</span><b className="mt-1 block text-sm">{title}</b><span className="mt-1 block text-[10px] text-muted-foreground">{sub}</span></Link>)}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <section className="rounded-xl border bg-background shadow-sm">
          <div className="flex items-center justify-between border-b p-4"><div><h2 className="text-sm font-bold">Purchase order control</h2><p className="mt-1 text-[11px] text-muted-foreground">Track ordered quantity against what has actually been received.</p></div><Link href={`${base}/purchase-orders`} className="text-xs font-bold text-primary">All POs</Link></div>
          <div className="divide-y">{data.purchaseOrders.map(po => { const pct = po.orderedUnits ? Math.min(100, Math.round(po.receivedUnits / po.orderedUnits * 100)) : 0; return <Link key={po.id} href={`${base}/purchase-orders/${po.id}`} className="block p-4 hover:bg-muted/20"><div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm">{po.poNumber}</b><p className="mt-0.5 text-xs text-muted-foreground">{po.supplier}</p></div><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass[po.status] ?? "bg-muted"}`}>{po.status.replaceAll("_", " ")}</span></div><div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div><span className="text-[10px] font-bold">{po.receivedUnits}/{po.orderedUnits}</span><span className="text-xs font-bold">{money(po.subtotal, po.currency)}</span></div>{po.expectedAt && <p className="mt-2 text-[10px] text-muted-foreground">Expected {new Date(po.expectedAt).toLocaleDateString("en-NG")}</p>}</Link> })}{!data.purchaseOrders.length && <p className="p-8 text-center text-xs text-muted-foreground">No purchase orders yet.</p>}</div>
        </section>

        <section className="rounded-xl border bg-background shadow-sm">
          <div className="flex items-center justify-between border-b p-4"><div><h2 className="text-sm font-bold">Supplier performance</h2><p className="mt-1 text-[11px] text-muted-foreground">Spend, open commitments and delivery reliability.</p></div><Link href={`${base}/suppliers`} className="text-xs font-bold text-primary">All suppliers</Link></div>
          <div className="divide-y">{data.suppliers.map(s => <Link key={s.id} href={`${base}/suppliers/${s.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/20"><div className="min-w-0"><b className="block truncate text-sm">{s.name}</b><p className="mt-1 text-[10px] text-muted-foreground">{s.orders} PO{s.orders === 1 ? '' : 's'} · {s.openOrders} open</p></div><div className="text-right"><b className="text-sm">{money(s.spend)}</b><p className="mt-1 text-[10px] text-muted-foreground">{s.onTimeRate == null ? 'No delivery history' : `${s.onTimeRate}% on time`}</p></div></Link>)}{!data.suppliers.length && <p className="p-8 text-center text-xs text-muted-foreground">No suppliers yet.</p>}</div>
        </section>
      </div>

      <section className="rounded-xl border bg-background shadow-sm">
        <div className="flex items-center justify-between border-b p-4"><div><h2 className="text-sm font-bold">Requisitions entering procurement</h2><p className="mt-1 text-[11px] text-muted-foreground">Financial Control approves spend before Procurement turns an approved request into a PO.</p></div><Link href={`${base}/apps/requisition`} className="text-xs font-bold text-primary">View queue</Link></div>
        <div className="divide-y">{data.requisitions.map(r => <Link key={r.id} href={`${base}/apps/requisition`} className="flex flex-col gap-2 p-4 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{r.number}</b><span className="text-xs text-muted-foreground">{r.title}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass[r.status] ?? 'bg-muted'}`}>{r.status}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{r.department || 'General'} · {r.requesterName || 'Staff member'}{r.neededBy ? ` · Needed by ${new Date(r.neededBy).toLocaleDateString('en-NG')}` : ''}</p></div><b className="text-sm">{r.estimate > 0 ? money(r.estimate) : 'Estimate pending'}</b></Link>)}{!data.requisitions.length && <p className="p-8 text-center text-xs text-muted-foreground">No active requisitions.</p>}</div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href={`${base}/suppliers`} className="rounded-xl border p-4 hover:bg-muted/20"><Boxes className="h-4 w-4 text-primary" /><b className="mt-2 block text-sm">Supplier master</b><p className="mt-1 text-[10px] text-muted-foreground">{data.summary.activeSuppliers} active suppliers · {data.summary.suppliers} total</p></Link>
        <Link href={`${base}/purchase-orders`} className="rounded-xl border p-4 hover:bg-muted/20"><ReceiptText className="h-4 w-4 text-primary" /><b className="mt-2 block text-sm">Purchase orders</b><p className="mt-1 text-[10px] text-muted-foreground">Create, send, track and receive against POs.</p></Link>
        <Link href={`${base}/inventory`} className="rounded-xl border p-4 hover:bg-muted/20"><FileText className="h-4 w-4 text-primary" /><b className="mt-2 block text-sm">Inventory handoff</b><p className="mt-1 text-[10px] text-muted-foreground">Accepted receipts become stock through the inventory ledger.</p></Link>
      </div>
    </div>
  );
}
