// Route: /store/[slug]/admin/receipts
// One place for a vendor to find and print order receipts, payment receipts and bills.
import Link from "next/link";
import { Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { formatDate } from "@/lib/i18n/locale";
import { moneyFormatter } from "@/lib/utils/format-money";

const PAID_ORDER = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;
const TABS = [
  { id: "orders", label: "Order receipts" },
  { id: "payments", label: "Payment receipts" },
  { id: "bills", label: "Bills" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function ReceiptsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { slug } = await params;
  const { type } = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === type) ? (type as TabId) : "orders";

  const access = await assertAnyStorePermission(slug, ["orders", "pos", "payments", "finance"]);
  if (!access.success) return <p className="text-sm text-muted-foreground">{access.error}</p>;
  const store = access.store;
  const money = moneyFormatter(store);
  const date = (d: Date) => formatDate(d, { locale: store.locale, timeZone: store.timezone });

  type Row = { id: string; kind: "order" | "payment" | "bill"; ref: string; who: string; amount: string; when: string; status: string };
  let rows: Row[] = [];

  if (tab === "orders") {
    const orders = await prisma.order.findMany({
      where: { storeId: store.id, status: { in: [...PAID_ORDER] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { buyer: { select: { name: true, email: true } } },
    });
    rows = orders.map((o) => ({
      id: o.id,
      kind: "order",
      ref: `#${o.id.slice(-8).toUpperCase()}`,
      who: o.channel === "POS" ? o.posCustomerName ?? "Walk-in customer" : o.buyer.name ?? o.buyer.email ?? "—",
      amount: money(Number(o.total)),
      when: date(o.createdAt),
      status: o.status.replace(/_/g, " "),
    }));
  } else if (tab === "payments") {
    const payments = await prisma.payment.findMany({
      where: {
        status: "SUCCESSFUL",
        purpose: { notIn: ["SUBSCRIPTION_UPGRADE", "SUBSCRIPTION_RENEWAL", "PLUGIN_PURCHASE", "AD_CAMPAIGN"] },
        OR: [
          { storeId: store.id },
          { order: { storeId: store.id } },
          { booking: { storeId: store.id } },
          { reservation: { storeId: store.id } },
          { invoice: { storeId: store.id } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { order: { include: { buyer: { select: { name: true, email: true } } } }, invoice: true, booking: true },
    });
    rows = payments.map((p) => ({
      id: p.id,
      kind: "payment",
      ref: p.reference.length > 18 ? `…${p.reference.slice(-12)}` : p.reference,
      who: p.order?.buyer.name ?? p.invoice?.customerName ?? p.booking?.guestName ?? "—",
      amount: money(Number(p.amount)),
      when: date(p.verifiedAt ?? p.createdAt),
      status: p.purpose.replace(/_/g, " "),
    }));
  } else {
    const invoices = await prisma.invoice.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { customer: { select: { name: true } } },
    });
    rows = invoices.map((i) => ({
      id: i.id,
      kind: "bill",
      ref: i.invoiceNo,
      who: i.customerName ?? i.customer?.name ?? "—",
      amount: money(Number(i.total)),
      when: date(i.createdAt),
      status: i.status,
    }));
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Receipts</h1>
      <p className="mb-4 max-w-xl text-sm text-muted-foreground">
        Print an order receipt, a payment receipt or a bill for any customer. Pick A4 or an 80mm roll on the print screen.
      </p>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/store/${slug}/admin/receipts?type=${t.id}`}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${tab === t.id ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing to print here yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl border bg-background p-4 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-primary">
                <Printer className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.who}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  <span className="font-mono">{r.ref}</span> · {r.when} · <span className="capitalize">{r.status.toLowerCase()}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums">{r.amount}</p>
                <a
                  href={`/receipts/${slug}/${r.kind}/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-muted"
                >
                  Print
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length === 50 && <p className="mt-3 text-xs text-muted-foreground">Showing the latest 50.</p>}
    </div>
  );
}
