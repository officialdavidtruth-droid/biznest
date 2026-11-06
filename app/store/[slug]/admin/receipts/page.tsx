// Route: /store/[slug]/admin/receipts
// One place for a vendor to find and print order receipts, payment receipts and bills.
import Link from "next/link";
import { Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { formatDate } from "@/lib/i18n/locale";
import { moneyFormatter } from "@/lib/utils/format-money";
import { TableScroll } from "@/components/ui/table-scroll";

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
      <p className="mb-5 max-w-xl text-sm text-muted-foreground">
        Print an order receipt, a payment receipt or a bill for any customer. Choose A4 or an 80mm receipt roll on the print screen.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/${slug}/admin/receipts?type=${t.id}`}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${tab === t.id ? "bg-foreground text-background" : "bg-background text-muted-foreground"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <TableScroll className="rounded-lg border bg-background">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">{tab === "payments" ? "For" : "Status"}</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{r.ref}</td>
                <td className="px-4 py-3">{r.who}</td>
                <td className="px-4 py-3">{r.amount}</td>
                <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{r.status.toLowerCase()}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.when}</td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/receipts/${slug}/${r.kind}/${r.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print
                  </a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Nothing to print here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
      {rows.length === 50 && <p className="mt-2 text-xs text-muted-foreground">Showing the latest 50.</p>}
    </div>
  );
}
