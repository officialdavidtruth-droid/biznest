import Link from "next/link";
import {
  ArrowUpRight, ArrowDownRight, BarChart3, CalendarDays, ChevronDown, Clock3, ExternalLink,
  Lightbulb, Package, Plus, ShoppingBag, Sparkles, TrendingUp, Users,
  WalletCards, Utensils, CheckCircle2, CircleAlert, Truck, BriefcaseBusiness, Megaphone, Receipt,
} from "lucide-react";
import type { AdaptiveDashboardConfig } from "@/lib/adaptive-dashboard";
import { moneyFormatter } from "@/lib/utils/format-money";
import { formatNumber } from "@/lib/i18n/locale";
import { TableScroll } from "@/components/ui/table-scroll";

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
  /** Units sold in the last 30 days (paid orders only). */
  unitsSold: number;
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
  /** Hotels only: rooms that are dirty, in maintenance or out of service. */
  roomAttentionCount?: number;
  outOfStockCount: number;
  activeCatalogCount: number;
  recentOrders: DashboardOrder[];
  topProducts: DashboardProduct[];
  bookings: DashboardBooking[];
  // Real "vs yesterday" comparison signals — same rolling-24h shape, one
  // day back — plus the hourly breakdown that draws the revenue chart.
  revenueYesterday: number;
  ordersYesterday: number;
  newCustomersToday: number;
  newCustomersYesterday: number;
  avgOrderValueToday: number;
  avgOrderValueYesterday: number;
  hourlyRevenue: number[];
  /** Store-local hour (0-23) right now; the revenue chart ends here. */
  currentHour?: number;
  /** True when the viewer (staff) lacks the analytics permission: sales
   * figures are replaced with placeholders instead of misleading zeros. */
  analyticsHidden?: boolean;
  /** Restaurants only: today's paid orders by kitchen stage. */
  kitchen?: { waiting: number; preparing: number; ready: number };
};

type KpiSub = { text: string; direction?: "up" | "down" };

/** Turns a today/yesterday pair into the small delta badge the reference
 * design shows under each KPI ("↑ 26% from yesterday"). Falls back to a
 * plain "Today" label when there's no usable yesterday baseline, instead
 * of a misleading 0%/∞% swing. */
function deltaSub(today: number, yesterday: number): KpiSub {
  if (yesterday <= 0) return { text: "Today" };
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (pct === 0) return { text: "Same as yesterday" };
  return { text: `${Math.abs(pct)}% from yesterday`, direction: pct > 0 ? "up" : "down" };
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

function pluralize(noun: string) {
  return /[^aeiou]y$/i.test(noun) ? `${noun.slice(0, -1)}ies` : `${noun}s`;
}

/** The header's primary button. The label and the destination are chosen
 * together so the button always does what it says: "New …" only where the
 * destination really has a way to create one (POS for orders, the invoice
 * form, add-product/service pages, the PMS for hotel reservations); anywhere
 * else it honestly says "View …". Previously the label came from the
 * business type but the link was just the first quick action, so "New Order"
 * could open Products or Bookings. */
function primaryAction(
  config: AdaptiveDashboardConfig,
  first: AdaptiveDashboardConfig["quickActions"][number] | undefined,
  hasProducts: boolean,
): { label: string; href: string } {
  const transaction = config.terminology.transaction;
  // Selling products: the daily action is ringing up an order. /pos hands
  // restaurants with FnB installed over to the FnB workspace.
  if (transaction === "Order" && hasProducts) return { label: "New Order", href: "/pos" };
  switch (first?.href) {
    case "/products":
    case "/services":
      return { label: `Add ${config.terminology.catalogSingular}`, href: `${first.href}/new` };
    case "/invoices":
      return { label: "New Invoice", href: "/invoices" };
    case "/pms":
      return { label: "New Reservation", href: "/pms" };
    case "/orders":
    case "/bookings":
      return { label: `View ${pluralize(transaction)}`, href: first.href };
    default:
      return first ? { label: `View ${first.label}`, href: first.href } : { label: "View Products", href: "/products" };
  }
}

function quickIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("pos") || l.includes("point of sale")) return Receipt;
  if (l.includes("order")) return ShoppingBag;
  if (l.includes("menu") || l.includes("product") || l.includes("service") || l.includes("package")) return Package;
  if (l.includes("reservation") || l.includes("booking") || l.includes("appointment") || l.includes("calendar")) return CalendarDays;
  if (l.includes("customer") || l.includes("client") || l.includes("guest")) return Users;
  if (l.includes("inventory")) return Package;
  if (l.includes("promo") || l.includes("marketing")) return Megaphone;
  if (l.includes("report") || l.includes("analytics")) return BarChart3;
  if (l.includes("delivery")) return Truck;
  if (l.includes("project")) return BriefcaseBusiness;
  return Plus;
}

// Every niche shares the same quick-action *destinations* (products vs.
// services, bookings, inventory, marketing, analytics...) but the verb a
// merchant expects differs — a restaurant owner thinks "Add Menu Item", a
// salon owner thinks "Add Service". Keyed off href (the actual capability)
// plus the config's own terminology, so a new category automatically gets
// sensible wording without a bespoke label table.
function quickActionLabel(config: AdaptiveDashboardConfig, action: AdaptiveDashboardConfig["quickActions"][number], isRestaurant: boolean): string {
  switch (action.href) {
    case "/bookings":
      return isRestaurant ? "New Reservation" : `New ${config.terminology.transaction}`;
    case "/products":
    case "/services":
      return `Add ${config.terminology.catalogSingular}`;
    case "/inventory":
      return "Manage Inventory";
    case "/apps/crm/marketing":
      return "Promotions";
    case "/analytics":
      return "View Reports";
    case "/orders":
      return `${pluralize(config.terminology.transaction)}`;
    default:
      return action.label;
  }
}

export function AdaptiveDashboardHome({
  slug,
  storeName,
  userName,
  userImage,
  currency,
  locale,
  config,
  data,
}: {
  slug: string;
  storeName: string;
  userName?: string | null;
  userImage?: string | null;
  /** The store's display currency/locale (Store.currency / Store.locale). */
  currency?: string | null;
  locale?: string | null;
  config: AdaptiveDashboardConfig;
  data: DashboardHomeData;
}) {
  const base = `/${slug}/admin`;
  const money = moneyFormatter({ currency, locale }, { decimals: 0 });
  const isRestaurant = config.businessType === "Restaurant";
  const isHotel = config.businessType === "Hotel & Lodging";
  const hasProducts = config.modules.some((m) => m.id === "products") || data.productCount > 0;
  const hasServices = config.modules.some((m) => m.id === "services") || data.serviceCount > 0;
  const hasBookings = config.modules.some((m) => m.id === "bookings") || data.bookingCount > 0;

  // "sub" carries a real vs-yesterday delta wherever we have a yesterday
  // baseline to compare against; falls back to a plain "Today"/"Active"
  // label for sources with no meaningful day-over-day comparison (e.g. an
  // active catalog count, or a first-ever day with zero prior activity).
  const kpis = config.kpis.slice(0, 5).map((kpi) => {
    let value = "—";
    let sub: KpiSub = { text: "Today" };
    if (kpi.source === "revenue") { value = money(data.revenueToday); sub = deltaSub(data.revenueToday, data.revenueYesterday); }
    if (kpi.source === "orders") { value = formatNumber(data.ordersToday); sub = deltaSub(data.ordersToday, data.ordersYesterday); }
    if (kpi.source === "bookings") { value = formatNumber(data.bookingCount); sub = { text: "Today" }; }
    if (kpi.source === "customers") { value = formatNumber(data.newCustomersToday); sub = deltaSub(data.newCustomersToday, data.newCustomersYesterday); }
    if (kpi.source === "avgOrderValue") { value = money(data.avgOrderValueToday); sub = deltaSub(data.avgOrderValueToday, data.avgOrderValueYesterday); }
    if (kpi.source === "products" || kpi.source === "services") { value = formatNumber(data.activeCatalogCount); sub = { text: "Active" }; }
    if (kpi.source === "rooms") { value = formatNumber(data.roomCount); sub = { text: "Currently" }; }
    if (kpi.source === "visitors") { value = formatNumber(data.visitorsToday); sub = { text: "Storefront views today" }; }
    if (kpi.source === "conversion") { value = data.conversionRate === null ? "—" : `${data.conversionRate}%`; sub = { text: data.conversionRate === null ? "Needs 20+ views" : "Orders ÷ page views" }; }
    if (kpi.source === "bestProduct") { value = data.topProducts[0]?.name ?? "—"; sub = { text: "Last 30 days" }; }
    return { ...kpi, value, sub };
  });

  // The reference design uses five KPI cards. Fill the remaining slots with
  // meaningful capability-specific cards instead of leaving awkward gaps
  // (only reached by niches whose config.kpis has fewer than 5 entries).
  const fallbackKpis = [
    ...(hasBookings ? [{ id: "bookings", label: isHotel ? "Reservations" : pluralize(config.terminology.transaction), value: formatNumber(data.bookingCount), sub: { text: "Today" } as KpiSub }] : []),
    ...(hasProducts ? [{ id: "catalog", label: config.terminology.catalog, value: formatNumber(data.activeCatalogCount), sub: { text: "Active" } as KpiSub }] : []),
    ...(isHotel ? [{ id: "rooms", label: "Available Rooms", value: formatNumber(Math.max(0, data.roomCount)), sub: { text: "Currently" } as KpiSub }] : []),
  ];
  // Sales-derived KPIs read "—" for staff without the analytics permission.
  const SALES_SOURCES = new Set(["revenue", "orders", "visitors", "conversion", "customers", "avgOrderValue", "bestProduct"]);
  const gatedKpis = data.analyticsHidden
    ? kpis.map((kpi) => (SALES_SOURCES.has(kpi.source) ? { ...kpi, value: "—", sub: { text: "No access" } as KpiSub } : kpi))
    : kpis;
  const finalKpis = [...gatedKpis, ...fallbackKpis].filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index).slice(0, 5);

  const quickActions = config.quickActions.slice(0, 6);
  const primary = primaryAction(config, quickActions[0], hasProducts);
  const primaryClass = "inline-flex items-center rounded-lg bg-[var(--bn-admin-surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--bn-admin-text)] shadow-sm transition hover:brightness-95";
  const recentOrders = data.recentOrders.slice(0, 5);
  const topProducts = data.topProducts.slice(0, 5);
  const bookings = data.bookings.slice(0, 5);

  return (
    <div className="bn-adaptive-dashboard min-h-full bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-text)]">
      <div className="bn-dashboard-content mx-auto w-full max-w-[1440px] px-4 pb-32 pt-5 sm:px-6 sm:pb-7 lg:px-7 lg:py-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--bn-admin-text)]">Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}! <span aria-hidden>👋</span></h1>
            <p className="mt-1 text-[14px] text-[var(--bn-admin-text)]">{titleFor(config)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`${base}/customize`} className="hidden rounded-lg border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] px-4 py-2.5 text-sm font-medium text-[var(--bn-admin-text)] shadow-sm transition hover:border-[var(--bn-admin-border)] sm:inline-flex">View Store <ExternalLink className="ml-2 h-4 w-4" /></Link>
            {primary.href === "/pms"
              ? <a href={`${base}${primary.href}`} className={primaryClass}><Plus className="mr-1.5 h-4 w-4" /> {primary.label}</a>
              : <Link href={`${base}${primary.href}`} className={primaryClass}><Plus className="mr-1.5 h-4 w-4" /> {primary.label}</Link>}
            <div className="hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] sm:flex">
              {userImage ? <img src={userImage} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="text-xs font-bold text-[var(--bn-admin-text)]">{(userName || storeName).slice(0, 1).toUpperCase()}</span>}
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
          {finalKpis.map((kpi, index) => (
            <div key={kpi.id} className="bn-dashboard-kpi rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] last:odd:col-span-2 sm:px-4 sm:py-4 lg:last:odd:col-span-1">
              <div className="mb-2 flex items-start justify-between sm:mb-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${index % 4 === 0 ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-muted)]" : index % 4 === 1 ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)]" : index % 4 === 2 ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-text)]" : "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-muted)]"}`}>
                  {index === 0 ? <WalletCards className="h-4.5 w-4.5" /> : index === 1 ? <ShoppingBag className="h-4.5 w-4.5" /> : index === 2 ? <TrendingUp className="h-4.5 w-4.5" /> : index === 3 ? <Users className="h-4.5 w-4.5" /> : <BarChart3 className="h-4.5 w-4.5" />}
                </span>
              </div>
              <p className="text-[13px] font-medium text-[var(--bn-admin-text)]">{kpi.label}</p>
              <p className="mt-1 text-[22px] font-bold sm:text-[25px] tracking-[-0.02em] text-[var(--bn-admin-text)]">{kpi.value}</p>
              <div className="mt-1 flex items-center gap-1 text-[11px]">
                {kpi.sub.direction ? (
                  <span className={`flex items-center gap-0.5 font-semibold ${kpi.sub.direction === "up" ? "text-[var(--bn-admin-text)]" : "text-[var(--bn-admin-orange)]"}`}>
                    {kpi.sub.direction === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {kpi.sub.text}
                  </span>
                ) : (
                  <span className="text-[var(--bn-admin-text)]">{kpi.sub.text}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <section className="mb-5 rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="text-[16px] font-bold">Quick Actions</h2><p className="mt-0.5 text-xs text-[var(--bn-admin-muted)]">Jump straight into the work that matters.</p></div>
            <Sparkles className="h-5 w-5 text-[var(--bn-admin-muted)]" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
            {quickActions.map((action) => {
              const label = quickActionLabel(config, action, isRestaurant);
              const Icon = quickIcon(label);
              const href = `${base}${action.href}`;
              const className = "group rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface-2)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--bn-admin-border)] hover:shadow-sm";
              const content = <><Icon className="mb-3 h-5 w-5 text-[var(--bn-admin-muted)]" /><p className="text-sm font-semibold text-[var(--bn-admin-text)]">{label}</p><p className="mt-1 text-[11px] text-[var(--bn-admin-muted)]">Open workspace</p></>;
              // PMS renders behind a different persistent shell via a
              // conditional branch in the shared admin layout — see
              // sidebar.tsx's NavLink for the full explanation. A plain <a>
              // forces a full reload so that branch re-evaluates correctly.
              return action.href === "/pms"
                ? <a key={action.id} href={href} className={className}>{content}</a>
                : <Link key={action.id} href={href} className={className}>{content}</Link>;
            })}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div className="space-y-5">
            {!data.analyticsHidden && <section className="rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="text-[16px] font-bold">Revenue Overview</h2><p className="mt-0.5 text-xs text-[var(--bn-admin-muted)]">Today, hour by hour</p></div></div>
              <RevenueChart hourly={data.hourlyRevenue} currentHour={data.currentHour ?? 23} />
              <div className="relative mt-2 h-4 text-[10px] text-[var(--bn-admin-muted)]">
                {[[0, "12am"], [6, "6am"], [12, "12pm"], [18, "6pm"], [23, "11pm"]].map(([h, label]) => (
                  <span key={h} className={`absolute ${h === 0 ? "" : h === 23 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${(Number(h) / 23) * 100}%` }}>{label}</span>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-2xl font-bold">{money(data.revenueToday)}</span>
                {(() => { const d = deltaSub(data.revenueToday, data.revenueYesterday); return (
                  <span className={`flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-semibold ${d.direction === "down" ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)]" : "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-text)]"}`}>
                    {d.direction === "up" ? <ArrowUpRight className="h-3 w-3" /> : d.direction === "down" ? <ArrowDownRight className="h-3 w-3" /> : null} {d.text}
                  </span>
                ); })()}
              </div>
            </section>}

            {topProducts.length > 0 ? <section className="rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[16px] font-bold">Top {config.terminology.catalog}</h2><p className="mt-0.5 text-xs text-[var(--bn-admin-muted)]">Last 30 days, by units sold</p></div><Link href={`${base}${hasProducts ? "/products" : "/services"}`} className="text-xs font-semibold text-[var(--bn-admin-orange)]">View all</Link></div><div className="divide-y divide-border">{topProducts.map((p) => <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[var(--bn-admin-surface-2)]">{p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Package className="h-5 w-5 text-[var(--bn-admin-muted)]" /></div>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-[11px] text-[var(--bn-admin-muted)]">{p.unitsSold} sold</p></div><span className="text-sm font-bold text-[var(--bn-admin-text)]">{money(p.revenue)}</span></div>)}</div></section> : <section className="rounded-xl border border-dashed border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-8 text-center"><Package className="mx-auto h-7 w-7 text-[var(--bn-admin-muted)]" />{data.activeCatalogCount > 0 ? <><h2 className="mt-2 text-sm font-bold">No sales in the last 30 days</h2><p className="mx-auto mt-1 max-w-md text-xs text-[var(--bn-admin-muted)]">Your best-selling {config.terminology.catalog.toLowerCase()} will show up here once you make a sale.</p></> : <><h2 className="mt-2 text-sm font-bold">Build your {config.terminology.catalog.toLowerCase()}</h2><p className="mx-auto mt-1 max-w-md text-xs text-[var(--bn-admin-muted)]">Add your first {config.terminology.catalogSingular.toLowerCase()} and BizNest will turn this space into a live performance view.</p></>}</section>}
          </div>

          <div className="space-y-5">
            {hasBookings && <section className="rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-bold">Today’s {isHotel ? "Reservations" : pluralize(config.terminology.transaction)}</h2><Link href={`${base}/bookings`} className="text-xs font-semibold text-[var(--bn-admin-orange)]">View all</Link></div><div className="divide-y divide-border">{bookings.length ? bookings.map((b) => <div key={b.id} className="flex items-center gap-3 py-3 first:pt-0"><div className="w-14 text-xs font-bold text-[var(--bn-admin-text)]">{b.time}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{b.customer}</p><p className="truncate text-[11px] text-[var(--bn-admin-muted)]">{b.detail}</p></div>{b.guests ? <span className="rounded-full bg-[var(--bn-admin-surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--bn-admin-muted)]">{b.guests} Guests</span> : <Clock3 className="h-4 w-4 text-[var(--bn-admin-muted)]" />}</div>) : <div className="py-8 text-center text-xs text-[var(--bn-admin-muted)]">No bookings scheduled yet.</div>}<Link href={`${base}/bookings`} className="mt-2 flex w-full items-center justify-center rounded-lg border border-[var(--bn-admin-border)] px-3 py-2 text-xs font-semibold text-[var(--bn-admin-orange)]">Manage {isHotel ? "Reservations" : "Bookings"}</Link></div></section>}

            <section className="rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-bold">{isRestaurant ? "Kitchen Status" : isHotel ? "Property Status" : "What needs attention"}</h2><CircleAlert className="h-5 w-5 text-[var(--bn-admin-muted)]" /></div><div className="space-y-2.5">{isRestaurant ? <><StatusRow icon={CircleAlert} title="Orders waiting" value={formatNumber(data.kitchen?.waiting ?? 0)} tone="amber" /><StatusRow icon={Utensils} title="Preparing" value={formatNumber(data.kitchen?.preparing ?? 0)} tone="blue" /><StatusRow icon={CheckCircle2} title="Ready / served" value={formatNumber(data.kitchen?.ready ?? 0)} tone="green" /></> : isHotel ? <><StatusRow icon={CheckCircle2} title="Rooms available" value={formatNumber(data.roomCount)} tone="green" /><StatusRow icon={Clock3} title="Arrivals / reservations" value={formatNumber(data.bookingCount)} tone="blue" /><StatusRow icon={CircleAlert} title="Rooms needing attention" value={formatNumber(data.roomAttentionCount ?? 0)} tone="amber" /></> : <><StatusRow icon={CheckCircle2} title={`${config.terminology.catalog} active`} value={formatNumber(data.activeCatalogCount)} tone="green" /><StatusRow icon={CalendarDays} title={`${pluralize(config.terminology.transaction)}`} value={formatNumber(data.bookingCount)} tone="blue" /><StatusRow icon={CircleAlert} title="Needs attention" value={formatNumber(data.outOfStockCount)} tone="amber" /></>}</div></section>

            <section className="overflow-hidden rounded-xl bg-[var(--bn-admin-page)] p-5 text-[var(--bn-admin-text)] shadow-[0_8px_24px_rgba(15,23,42,0.12)]"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-text)]"><Lightbulb className="h-4.5 w-4.5" /></div><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--bn-admin-muted)]">BizNest Insight</p><p className="mt-2 text-sm font-semibold leading-5">{data.outOfStockCount > 0 ? `You have ${data.outOfStockCount} item${data.outOfStockCount === 1 ? "" : "s"} that need attention.` : data.bookingCount > 0 ? `Your business has ${data.bookingCount} active ${(data.bookingCount === 1 ? config.terminology.transaction : pluralize(config.terminology.transaction)).toLowerCase()} today.` : "Your workspace is ready. Add your first listing to start building momentum."}</p><Link href={`${base}${data.outOfStockCount > 0 ? "/inventory" : hasBookings ? "/bookings" : hasProducts ? "/products" : "/services"}`} className="mt-4 inline-flex items-center rounded-lg bg-[var(--bn-admin-surface-2)] px-3 py-2 text-xs font-bold text-[var(--bn-admin-text)]">Take a look <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Link></div></div></section>
          </div>
        </div>

        {recentOrders.length > 0 && <section className="mt-5 rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[16px] font-bold">Recent {pluralize(config.terminology.transaction)}</h2><p className="mt-0.5 text-xs text-[var(--bn-admin-muted)]">Your latest business activity</p></div><Link href={`${base}/orders`} className="text-xs font-semibold text-[var(--bn-admin-orange)]">View all</Link></div><TableScroll><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-[var(--bn-admin-border)] text-[11px] uppercase tracking-wide text-[var(--bn-admin-muted)]"><th className="pb-3 font-semibold">ID</th><th className="pb-3 font-semibold">{config.terminology.customer}</th><th className="pb-3 font-semibold">Type</th><th className="pb-3 font-semibold">Amount</th><th className="pb-3 font-semibold">Status</th><th className="pb-3 font-semibold">Time</th></tr></thead><tbody className="divide-y divide-border">{recentOrders.map((o) => <tr key={o.id}><td className="py-3 font-semibold">#{o.id.slice(-6).toUpperCase()}</td><td className="py-3">{o.customer}</td><td className="py-3">{o.type}</td><td className="py-3 font-semibold">{money(o.amount)}</td><td className="py-3"><span className="rounded-full bg-[var(--bn-admin-surface-2)] px-2.5 py-1 text-[10px] font-semibold text-[var(--bn-admin-text)]">{o.status}</span></td><td className="py-3 text-[var(--bn-admin-text)]">{o.time}</td></tr>)}</tbody></table></TableScroll></section>}
      </div>
    </div>
  );
}

// Smooth SVG area/line chart over the real 24 hourly revenue buckets
// (see getDashboardInsights) — matches the reference design's line-chart
// look while plotting actual data instead of a decorative fixed shape.
function RevenueChart({ hourly, currentHour }: { hourly: number[]; currentHour: number }) {
  const width = 1000;
  const height = 220;
  const padTop = 12;
  const padBottom = 8;
  const max = Math.max(1, ...hourly);
  // The x axis spans the whole day (hours 0-23) but the line only covers hours
  // that have happened -- future hours have no data yet and must not plot as 0.
  const last = Math.max(0, Math.min(hourly.length - 1, currentHour));
  const points = hourly.slice(0, last + 1).map((v, i) => {
    const x = (i / Math.max(1, hourly.length - 1)) * width;
    const y = padTop + (1 - v / max) * (height - padTop - padBottom);
    return [x, y] as const;
  });

  // Catmull-Rom → cubic-bezier smoothing so the line curves instead of
  // kinking at every hourly data point.
  function smoothPath(pts: readonly (readonly [number, number])[]) {
    if (pts.length < 2) return "";
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  const linePath = smoothPath(points);
  const lastPoint = points[points.length - 1];
  // Close the area under the line at the last real point, not the right edge.
  const areaPath = linePath ? `${linePath} L ${lastPoint[0]},${height} L 0,${height} Z` : "";
  const total = hourly.reduce((sum, v) => sum + v, 0);

  return (
    <div className="h-[150px] border-b sm:h-[235px] border-l border-[var(--bn-admin-border)]">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label={total > 0 ? "Revenue so far today, by hour" : "No revenue recorded yet today"}>
        <defs>
          <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--bn-admin-orange)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--bn-admin-orange)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {linePath ? (
          <>
            <path className="bn-revenue-area" d={areaPath} fill="url(#revenue-fill)" stroke="none" />
            <path className="bn-revenue-line" pathLength={1} d={linePath} fill="none" stroke="var(--bn-admin-orange)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          </>
        ) : (
          // Only one hour has elapsed: a line needs two points, so mark it with a dot.
          <circle cx={points[0]?.[0] ?? 0} cy={points[0]?.[1] ?? height} r={4} fill="var(--bn-admin-orange)" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  );
}

function StatusRow({ icon: Icon, title, value, tone }: { icon: typeof CircleAlert; title: string; value: string; tone: "amber" | "blue" | "green" }) {
  const styles = tone === "green" ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-text)]" : tone === "blue" ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-muted)]" : "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)]";
  return <div className="flex items-center gap-3 rounded-lg border border-[var(--bn-admin-border)] px-3 py-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${styles}`}><Icon className="h-4 w-4" /></span><span className="flex-1 text-xs font-medium text-[var(--bn-admin-text)]">{title}</span><span className="text-sm font-bold text-[var(--bn-admin-text)]">{value}</span></div>;
}
