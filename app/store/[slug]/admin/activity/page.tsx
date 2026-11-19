// Route: /store/[slug]/admin/activity
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getStoreAccessRole, canManageBillingAndStaff } from "@/lib/access/store-access";
import { listStoreActivity } from "@/lib/actions/activity";
import { formatDate } from "@/lib/i18n/locale";

const ACTION_LABELS: Record<string, string> = {
  "staff.invited": "invited a staff member",
  "staff.reinvited": "re-invited a staff member",
  "staff.joined": "accepted a staff invite",
  "staff.access_updated": "updated a staff member's access",
  "staff.removed": "removed a staff member",
  "product.created": "created a product",
  "product.updated": "edited a product",
  "product.deleted": "deleted a product",
  "order.status_updated": "updated an order's status",
  "order.refunded": "refunded an order",
  "order.bank_transfer_confirmed": "confirmed a bank transfer payment",
  "payment.refund_reconciled": "reconciled a refund",
  "pos.sale_completed": "completed a POS sale",
  "pos.commission_settled": "settled a commission",
  "payments.bank_details_updated": "updated bank transfer details",
  "payments.gateway_keys_saved": "saved payment gateway keys",
  "payments.gateway_keys_removed": "removed payment gateway keys",
  "payments.own_gateway_enabled": "switched on their own payment gateway",
  "payments.own_gateway_disabled": "switched off their own payment gateway",
  "settings.tracking_updated": "updated tracking settings",
  "settings.domain_set": "connected a custom domain",
  "settings.domain_removed": "removed the custom domain",
  "coupon.created": "created a coupon",
  "giftcard.issued": "issued a gift card",
  "giftcard.disabled": "disabled a gift card",
  "giftcard.enabled": "re-enabled a gift card",
  "giftcard.redeemed_in_store": "redeemed a gift card in store",
  "inventory.stock_adjusted": "adjusted stock",
  "referral.settings_updated": "updated referral settings",
  "referral.cancelled": "cancelled a referral",
  "referral.payout_retried": "retried a referral payout",
  "automation.created": "created an automation",
  "automation.activated": "turned on an automation",
  "hr.employee_created": "added an employee",
  "delivery_zone.created": "added a delivery zone",
  "delivery_zone.updated": "edited a delivery zone",
  "delivery_zone.deleted": "removed a delivery zone",
  "delivery_zone.toggled": "turned a delivery zone on or off",
};

function describe(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

function formatMeta(metadata: unknown): string[] | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const parts = Object.entries(metadata as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .filter(([k, v]) => !(/id$/i.test(k) && String(v).length > 16))
    .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase()}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.length ? parts.slice(0, 6) : null;
}

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam, action } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/store/${slug}/admin/activity`)}`);

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) notFound();

  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (!canManageBillingAndStaff(role)) redirect(`/store/${slug}/admin`);

  const [result, actionRows] = await Promise.all([
    listStoreActivity(slug, { page: Number.parseInt(pageParam ?? "1", 10) || 1, action: action || undefined }),
    prisma.storeActivityLog.findMany({ where: { storeId: store.id }, distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);
  const { entries, total, page, pageSize } = result.success ? result.data : { entries: [], total: 0, page: 1, pageSize: 50 };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const qs = (p: number) => `?page=${p}${action ? `&action=${encodeURIComponent(action)}` : ""}`;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Activity log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        What your staff and managers have been doing in this store&apos;s dashboard.
      </p>

      <form className="mt-4 flex gap-2">
        <select name="action" defaultValue={action ?? ""} className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm">
          <option value="">All actions</option>
          {actionRows.map((r) => (
            <option key={r.action} value={r.action}>{describe(r.action)}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Filter</button>
      </form>

      {entries.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">Nothing logged yet.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {entries.map((e) => {
            const meta = formatMeta(e.metadata);
            return (
              <li key={e.id} className="flex items-start gap-3 rounded-2xl border bg-background p-4 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-sm font-semibold text-primary">
                  {(e.actorName ?? "?").trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <span className="font-semibold">{e.actorName}</span> {describe(e.action)}
                    {e.target && /^#/.test(String(e.target)) ? <span className="font-semibold text-primary"> {e.target}</span> : null}
                  </p>
                  {meta && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {meta.map((m) => (
                        <span key={m} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{m}</span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {e.actorEmail} · {e.actorRole.replace(/_/g, " ").toLowerCase()} ·{" "}
                    {formatDate(new Date(e.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={qs(page - 1)} className="rounded-md border px-3 py-1.5">Newer</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {pages} · {total} entries</span>
          {page < pages ? <Link href={qs(page + 1)} className="rounded-md border px-3 py-1.5">Older</Link> : <span />}
        </div>
      )}
    </div>
  );
}
