import Link from "next/link";
import { BarChart3, Boxes, ClipboardCheck, FileText, ShoppingCart, Truck, Users, Wallet } from "lucide-react";
import type { getPluginWorkspace } from "@/lib/actions/plugin-workspaces";

type WorkspaceData = Awaited<ReturnType<typeof getPluginWorkspace>> & { error?: string };

export function PluginWorkspace({ slug, data }: { slug: string; data: WorkspaceData }) {
  if ("error" in data || !data.plugin) return null;
  const s: any = data.special;

  const cards: [string, number | string, typeof Users][] = (() => {
    switch (s.kind) {
      case "procurement":
        return [["Suppliers", s.suppliers, Boxes], ["Open POs", s.openPos, ShoppingCart], ["Pending approvals", s.pendingApprovals, ClipboardCheck], ["Requisitions", s.requisitions, FileText], ["Spend (30d)", s.spend30.toLocaleString(), Wallet]];
      case "analytics":
        return [["Orders (30d)", s.orders, ShoppingCart], ["Revenue (30d)", s.revenue30.toLocaleString(), Wallet], ["Customers (30d)", s.customers, Users], ["Visitors (30d)", s.visitors, Users], ["Low stock", s.lowStock, Boxes]];
      case "helpdesk":
        return [["Conversations", s.conversations, FileText], ["Unread", s.unread, FileText], ["Customers", s.customers, Users]];
      case "assets":
        return [["Assets", s.assets, Boxes], ["Active", s.active, Boxes], ["Total cost", s.totalCost.toLocaleString(), Wallet]];
      case "legal":
        return [["Documents", s.documents, FileText], ["Expiring soon", s.expiring, FileText], ["Expired", s.expired, FileText], ["Pending approvals", s.approvals, ClipboardCheck]];
      case "fleet":
        return [["Vehicles", s.vehicles, Truck], ["Fuel spend (30d)", s.fuelSpend30.toLocaleString(), Wallet]];
      case "loyalty":
        return [["Accounts", s.accounts, Users], ["Points balance", s.balance, Wallet], ["Earned (30d)", s.earned30, Wallet], ["Redeemed (30d)", s.redeemed30, Wallet]];
      case "hr":
        return [["Active staff", s.activeStaff, Users], ["Pending invites", s.pendingInvites, Users], ["Admins", s.admins, Users]];
      default:
        return [["Orders (7d)", s.orders, ShoppingCart], ["Customers", s.customers, Users], ["Products", s.products, Boxes]];
    }
  })();

  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest App</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{data.plugin.name}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{data.plugin.description}</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,Icon])=><div key={label} className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary"/></div><p className="mt-2 text-xl font-bold">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">Live from your BizNest workspace</p></div>)}</div>
    <section className="rounded-xl border bg-background p-4 shadow-sm"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary"/><h2 className="text-sm font-bold">Manage {data.plugin.name}</h2></div><div className="mt-3"><Link href={`/store/${slug}/admin/apps`} className="text-xs font-semibold text-primary">Back to apps</Link></div></section>
  </div>;
}