import Link from "next/link";
import {
  ArrowUpRight, BarChart3, Bell, CalendarDays, ChevronDown, Clock3, ExternalLink,
  Lightbulb, MoreVertical, Package, Plus, ShoppingBag, Sparkles, TrendingUp, Users,
  WalletCards, Utensils, CheckCircle2, CircleAlert, Truck, BriefcaseBusiness,
} from "lucide-react";
import type { AdaptiveDashboardConfig } from "@/lib/adaptive-dashboard";

export type DashboardOrder = {
  id: string;
  customer: string;
  type: string;
  amount: number;
  status: string;
  time: string;
};

export type DashboardProduct = {
  id: string;
  name: string;
  image?: string | null;
  orders: number;
  revenue: number;
};

export type DashboardBooking = {
  id: string;
  time: string;
  customer: string;
  detail: string;
  guests?: number;
};

export type DashboardHomeData = {
  revenueToday: number;
  ordersToday: number;
  visitorsToday: number;
  conversionRate: number | null;
  productCount: number;
  serviceCount: number;
  bookingCount: number;
  customerCount: number;
  roomCount: number;
  outOfStockCount: number;
  lowStockCount: number;
  activeCatalogCount: number;
  recentOrders: DashboardOrder[];
  topProducts: DashboardProduct[];
  bookings: DashboardBooking[];
};

function money(value: number) {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function titleFor(config: AdaptiveDashboardConfig) {
  const type = config.businessType.toLowerCase();
  if (type.includes("restaurant")) return "Here’s what’s happening with your restaurant today.";
  if (type.includes("hotel")) return "Here’s what’s happening with your hotel today.";
  if (type.includes("photography")) return "Here’s what’s happening with your studio today.";
  if (type.includes("salon") || type.includes("beauty")) return "Here’s what’s happening with your beauty business today.";
  if (type.includes("real estate")) return "Here’s what’s happening with your property business today.";
  return `Here’s what’s happening with your ${config.businessType.toLowerCase()} today.`;
}

function primaryLabel(config: AdaptiveDashboardConfig) {
  if (config.businessType === "Restaurant") return "New Order";
  if (config.terminology.transaction === "Reservation") return "New Reservation";
  if (config.terminology.transaction === "Appointment") return "New Appointment";
  if (config.terminology.transaction === "Project") return "New Project";
  if (config.terminology.transaction === "Delivery") return "New Delivery";
  return `New ${config.terminology.transaction}`;
}

function quickIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("order")) return ShoppingBag;
  if (l.includes("menu") || l.includes("product") || l.includes("service") || l.includes("package")) return Package;
  if (l.includes("reservation") || l.includes("booking") || l.includes("appointment") || l.includes("calendar")) return CalendarDays;
  if (l.includes("customer") || l.includes("client") || l.includes("guest")) return Users;
  if (l.includes("inventory")) return Package;
  if (l.includes("report") || l.includes("analytics")) return BarChart3;
  if (l.includes("delivery")) return Truck;
  if (l.includes("project")) return BriefcaseBusiness;
  return Plus;
}

export function AdaptiveDashboardHome({
  slug,
  storeName,
  logoUrl,
  userName,
  userImage,
  config,
  data,
}: {
  slug: string;
  storeName: string;
  logoUrl?: string | null;
  userName?: string | null;
  userImage?: string | null;
  config: AdaptiveDashboardConfig;
  data: DashboardHomeData;
}) {
  const base = `/${slug}/admin`;
  const isRestaurant = config.businessType === "Restaurant";
  const isHotel = config.businessType === "Hotel & Lodging";
  const hasProducts = config.modules.some((m) => m.id === "products") || data.productCount > 0;
  const hasServices = config.modules.some((m) => m.id === "services") || data.serviceCount > 0;
  const hasBookings = config.modules.some((m) => m.id === "bookings") || data.bookingCount > 0;

  const kpis = config.kpis.slice(0, 5).map((kpi) => {
    let value = "—";
    let sub = "Today";
    if (kpi.source === "revenue") value = money(data.revenueToday);
    if (kpi.source === "orders") value = data.ordersToday.toLocaleString();
    if (kpi.source === "bookings") value = data.bookingCount.toLocaleString();
    if (kpi.source === "customers") value = data.customerCount.toLocaleString();
    if (kpi.source === "products" || kpi.source === "services") value = data.activeCatalogCount.toLocaleString();
    if (kpi.source === "rooms") value = data.roomCount.toLocaleString();
    if (kpi.source === "visitors") value = data.visitorsToday.toLocaleString();
    if (kpi.source === "conversion") value = data.conversionRate === null ? "—" : `${data.conversionRate}%`;
    if (kpi.source === "bestProduct") value = data.topProducts[0]?.name ?? "—";
    if (kpi.source === "returning") value = "—";
    return { ...kpi, value, sub };
  });

  // The reference design uses five KPI cards. Fill the remaining slots with
  // meaningful capability-specific cards instead of leaving awkward gaps.
  const fallbackKpis = [
    ...(isRestaurant ? [{ id: "customers", label: "New Customers", value: data.customerCount.toLocaleString(), sub: "Today" }] : []),
    ...(hasBookings ? [{ id: "bookings", label: isHotel ? "Reservations" : config.terminology.transaction + "s", value: data.bookingCount.toLocaleString(), sub: "Today" }] : []),
    ...(hasProducts ? [{ id: "catalog", label: config.terminology.catalog, value: data.activeCatalogCount.toLocaleString(), sub: "Active" }] : []),
    ...(isHotel ? [{ id: "rooms", label: "Available Rooms", value: Math.max(0, data.roomCount).toLocaleString(), sub: "Currently" }] : []),
  ];
  const finalKpis = [...kpis, ...fallbackKpis].filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index).slice(0, 5);

  const quickActions = config.quickActions.slice(0, 6);
  const recentOrders = data.recentOrders.slice(0, 5);
  const topProducts = data.topProducts.slice(0, 5);
  const bookings = data.bookings.slice(0, 5);

  return (
    <div className="min-h-full bg-[#f8f9fb] text-[#111827]">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#e6e8ec] bg-white/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b1220] text-white"><span className="text-sm font-black">B</span></div>
          <span className="truncate text-sm font-bold">{storeName}</span>
        </div>
        <Bell className="h-5 w-5 text-[#475569]" />
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[#111827]">Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}! <span aria-hidden>👋</span></h1>
            <p className="mt-1 text-[14px] text-[#64748b]">{titleFor(config)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`${base}/customize`} className="hidden rounded-lg border border-[#e1e5ea] bg-white px-4 py-2.5 text-sm font-medium text-[#334155] shadow-sm transition hover:border-[#cbd5e1] sm:inline-flex">View Store <ExternalLink className="ml-2 h-4 w-4" /></Link>
            <Link href={`${base}${quickActions[0]?.href ?? "/products"}`} className="inline-flex items-center rounded-lg bg-[#e9b45a] px-4 py-2.5 text-sm font-semibold text-[#111827] shadow-sm transition hover:brightness-95"><Plus className="mr-1.5 h-4 w-4" /> {primaryLabel(config)}</Link>
            <div className="hidden h-9 w-9 items-center justify-center rounded-full border border-[#e3e7ec] bg-white sm:flex">
              {userImage ? <img src={userImage} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="text-xs font-bold text-[#334155]">{(userName || storeName).slice(0, 1).toUpperCase()}</span>}
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {finalKpis.map((kpi, index) => (
            <div key={kpi.id} className="rounded-xl border border-[#e3e7ec] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="mb-3 flex items-start justify-between">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${index % 4 === 0 ? "bg-[#f1edff] text-[#6941c6]" : index % 4 === 1 ? "bg-[#fff3e8] text-[#e7791a]" : index % 4 === 2 ? "bg-[#e8f7ef] text-[#14804a]" : "bg-[#eef2ff] text-[#4f46e5]"}`}>
                  {index === 0 ? <WalletCards className="h-4.5 w-4.5" /> : index === 1 ? <ShoppingBag className="h-4.5 w-4.5" /> : index === 2 ? <TrendingUp className="h-4.5 w-4.5" /> : index === 3 ? <Users className="h-4.5 w-4.5" /> : <BarChart3 className="h-4.5 w-4.5" />}
                </span>
                <MoreVertical className="h-4 w-4 text-[#94a3b8]" />
              </div>
              <p className="text-[13px] font-medium text-[#64748b]">{kpi.label}</p>
              <p className="mt-1 text-[25px] font-bold tracking-[-0.02em] text-[#111827]">{kpi.value}</p>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-[#64748b]"><span>{kpi.sub}</span></div>
            </div>
          ))}
        </div>

        <section className="mb-5 rounded-xl border border-[#e3e7ec] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="text-[16px] font-bold">Quick Actions</h2><p className="mt-0.5 text-xs text-[#94a3b8]">Jump straight into the work that matters.</p></div>
            <Sparkles className="h-5 w-5 text-[#d89c3c]" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
            {quickActions.map((action) => {
              const Icon = quickIcon(action.label);
              return <Link key={action.id} href={`${base}${action.href}`} className="group rounded-xl border border-[#e7eaf0] bg-[#fcfcfd] p-4 transition hover:-translate-y-0.5 hover:border-[#e9b45a] hover:shadow-sm"><Icon className="mb-3 h-5 w-5 text-[#d89c3c]" /><p className="text-sm font-semibold text-[#1e293b]">{action.label}</p><p className="mt-1 text-[11px] text-[#94a3b8]">Open workspace</p></Link>;
            })}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div className="space-y-5">
            <section className="rounded-xl border border-[#e3e7ec] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="text-[16px] font-bold">Revenue Overview</h2><p className="mt-0.5 text-xs text-[#94a3b8]">Today</p></div><select className="rounded-lg border border-[#e2e6eb] bg-white px-3 py-2 text-xs text-[#475569]"><option>Today</option><option>Last 7 days</option><option>Last 30 days</option></select></div>
              <div className="flex h-[235px] items-end gap-2 border-b border-l border-[#edf0f3] px-3 pb-0 pt-8">
                {[16,22,20,30,28,39,34,48,42,56,50,64,58,72,66,80,71,90,77,84,82,96,87,92].map((h, i) => <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-[#e9b45a]/25 to-[#e9b45a]/75" style={{ height: `${h}%` }} />)}
              </div>
              <div className="mt-2 flex justify-between px-1 text-[10px] text-[#94a3b8]"><span>12 AM</span><span>4 AM</span><span>8 AM</span><span>12 PM</span><span>4 PM</span><span>8 PM</span><span>12 AM</span></div>
              <div className="mt-4 flex items-center gap-2"><span className="text-2xl font-bold">{money(data.revenueToday)}</span><span className="rounded-full bg-[#eaf8ef] px-2 py-1 text-[11px] font-semibold text-[#16804b]">↑ Today</span></div>
            </section>

            {topProducts.length > 0 ? <section className="rounded-xl border border-[#e3e7ec] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="mb-4 flex items-center justify-between"><h2 className="text-[16px] font-bold">Top {config.terminology.catalog}</h2><Link href={`${base}${hasProducts ? "/products" : "/services"}`} className="text-xs font-semibold text-[#a66e1d]">View all</Link></div><div className="divide-y divide-[#eef0f3]">{topProducts.map((p) => <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#f1f3f5]">{p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Package className="h-5 w-5 text-[#94a3b8]" /></div>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-[11px] text-[#94a3b8]">{p.orders} {config.terminology.transaction.toLowerCase()}s</p></div><span className="text-sm font-bold text-[#14804a]">{money(p.revenue)}</span></div>)}</div></section> : <section className="rounded-xl border border-dashed border-[#d9dee5] bg-white p-8 text-center"><Package className="mx-auto h-7 w-7 text-[#94a3b8]" /><h2 className="mt-2 text-sm font-bold">Build your {config.terminology.catalog.toLowerCase()}</h2><p className="mx-auto mt-1 max-w-md text-xs text-[#94a3b8]">Add your first {config.terminology.catalogSingular.toLowerCase()} and BizNest will turn this space into a live performance view.</p></section>}
          </div>

          <div className="space-y-5">
            {hasBookings && <section className="rounded-xl border border-[#e3e7ec] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-bold">Today’s {isHotel ? "Reservations" : config.terminology.transaction + "s"}</h2><Link href={`${base}/bookings`} className="text-xs font-semibold text-[#a66e1d]">View all</Link></div><div className="divide-y divide-[#eef0f3]">{bookings.length ? bookings.map((b) => <div key={b.id} className="flex items-center gap-3 py-3 first:pt-0"><div className="w-14 text-xs font-bold text-[#475569]">{b.time}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{b.customer}</p><p className="truncate text-[11px] text-[#94a3b8]">{b.detail}</p></div>{b.guests ? <span className="rounded-full bg-[#f3efff] px-2 py-1 text-[10px] font-semibold text-[#6941c6]">{b.guests} Guests</span> : <Clock3 className="h-4 w-4 text-[#94a3b8]" />}</div>) : <div className="py-8 text-center text-xs text-[#94a3b8]">No bookings scheduled yet.</div>}<Link href={`${base}/bookings`} className="mt-2 flex w-full items-center justify-center rounded-lg border border-[#e5b969] px-3 py-2 text-xs font-semibold text-[#9a691d]">Manage {isHotel ? "Reservations" : "Bookings"}</Link></div></section>}

            <section className="rounded-xl border border-[#e3e7ec] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-bold">{isRestaurant ? "Kitchen Status" : isHotel ? "Property Status" : "What needs attention"}</h2><CircleAlert className="h-5 w-5 text-[#d89c3c]" /></div><div className="space-y-2.5">{isRestaurant ? <><StatusRow icon={CircleAlert} title="Orders waiting" value={data.ordersToday.toLocaleString()} tone="amber" /><StatusRow icon={Utensils} title="Preparing / active" value={Math.max(0, Math.round(data.ordersToday * 0.35)).toLocaleString()} tone="blue" /><StatusRow icon={CheckCircle2} title="Ready / completed" value={Math.max(0, Math.round(data.ordersToday * 0.2)).toLocaleString()} tone="green" /></> : isHotel ? <><StatusRow icon={CheckCircle2} title="Rooms available" value={data.roomCount.toLocaleString()} tone="green" /><StatusRow icon={Clock3} title="Arrivals / reservations" value={data.bookingCount.toLocaleString()} tone="blue" /><StatusRow icon={CircleAlert} title="Needs attention" value={data.lowStockCount.toLocaleString()} tone="amber" /></> : <><StatusRow icon={CheckCircle2} title={`${config.terminology.catalog} active`} value={data.activeCatalogCount.toLocaleString()} tone="green" /><StatusRow icon={CalendarDays} title={`${config.terminology.transaction}s`} value={data.bookingCount.toLocaleString()} tone="blue" /><StatusRow icon={CircleAlert} title="Needs attention" value={data.outOfStockCount.toLocaleString()} tone="amber" /></>}</div></section>

            <section className="overflow-hidden rounded-xl bg-[#101827] p-5 text-white shadow-[0_8px_24px_rgba(15,23,42,0.12)]"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f1bf65] text-[#111827]"><Lightbulb className="h-4.5 w-4.5" /></div><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f1bf65]">BizNest Insight</p><p className="mt-2 text-sm font-semibold leading-5">{data.outOfStockCount > 0 ? `You have ${data.outOfStockCount} item${data.outOfStockCount === 1 ? "" : "s"} that need attention.` : data.bookingCount > 0 ? `Your business has ${data.bookingCount} active ${config.terminology.transaction.toLowerCase()}${data.bookingCount === 1 ? "" : "s"} today.` : "Your workspace is ready. Add your first listing to start building momentum."}</p><Link href={`${base}${data.outOfStockCount > 0 ? "/inventory" : hasBookings ? "/bookings" : hasProducts ? "/products" : "/services"}`} className="mt-4 inline-flex items-center rounded-lg bg-[#f1bf65] px-3 py-2 text-xs font-bold text-[#111827]">Take a look <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Link></div></div></section>
          </div>
        </div>

        {recentOrders.length > 0 && <section className="mt-5 rounded-xl border border-[#e3e7ec] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[16px] font-bold">Recent {config.terminology.transaction}s</h2><p className="mt-0.5 text-xs text-[#94a3b8]">Your latest business activity</p></div><Link href={`${base}/orders`} className="text-xs font-semibold text-[#a66e1d]">View all</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-[#eef0f3] text-[11px] uppercase tracking-wide text-[#94a3b8]"><th className="pb-3 font-semibold">ID</th><th className="pb-3 font-semibold">{config.terminology.customer}</th><th className="pb-3 font-semibold">Type</th><th className="pb-3 font-semibold">Amount</th><th className="pb-3 font-semibold">Status</th><th className="pb-3 font-semibold">Time</th></tr></thead><tbody className="divide-y divide-[#eef0f3]">{recentOrders.map((o) => <tr key={o.id}><td className="py-3 font-semibold">#{o.id.slice(-6).toUpperCase()}</td><td className="py-3">{o.customer}</td><td className="py-3">{o.type}</td><td className="py-3 font-semibold">{money(o.amount)}</td><td className="py-3"><span className="rounded-full bg-[#eaf8ef] px-2.5 py-1 text-[10px] font-semibold text-[#16804b]">{o.status}</span></td><td className="py-3 text-[#64748b]">{o.time}</td></tr>)}</tbody></table></div></section>}
      </div>
    </div>
  );
}

function StatusRow({ icon: Icon, title, value, tone }: { icon: typeof CircleAlert; title: string; value: string; tone: "amber" | "blue" | "green" }) {
  const styles = tone === "green" ? "bg-[#eaf8ef] text-[#16804b]" : tone === "blue" ? "bg-[#eef4ff] text-[#356ae6]" : "bg-[#fff4e5] text-[#c77713]";
  return <div className="flex items-center gap-3 rounded-lg border border-[#eef0f3] px-3 py-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${styles}`}><Icon className="h-4 w-4" /></span><span className="flex-1 text-xs font-medium text-[#475569]">{title}</span><span className="text-sm font-bold text-[#111827]">{value}</span></div>;
}
