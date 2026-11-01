// Route: /store/[slug]/admin/folio
// Hotel room bills: everything charged to a guest's room, with settle, void and print.
import { Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { formatDate } from "@/lib/i18n/locale";
import { moneyFormatter } from "@/lib/utils/format-money";
import { SettleFolioButton, VoidChargeButton } from "@/components/dashboard/folio-actions";
import { TableScroll } from "@/components/ui/table-scroll";

export default async function FolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await assertAnyStorePermission(slug, ["orders", "pos", "payments", "finance"]);
  if (!access.success) return <p className="text-sm text-muted-foreground">{access.error}</p>;
  const store = access.store;
  const money = moneyFormatter(store);
  const date = (d: Date) => formatDate(d, { locale: store.locale, timeZone: store.timezone, day: "numeric", month: "short" });

  const reservations = await prisma.propertyReservation.findMany({
    where: { storeId: store.id, OR: [{ status: "CHECKED_IN" }, { folioCharges: { some: { status: "OPEN" } } }] },
    include: {
      room: { select: { name: true } },
      guest: { select: { fullName: true } },
      folioCharges: { where: { status: { not: "VOID" } }, orderBy: { postedAt: "asc" } },
    },
    orderBy: { checkIn: "desc" },
    take: 60,
  });

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Room bills</h1>
      <p className="mb-5 max-w-xl text-sm text-muted-foreground">
        Bills and POS orders posted to a guest&apos;s room land here. Settle the whole room bill at checkout, or print it for the guest.
      </p>

      {reservations.length === 0 && (
        <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">
          No guests are checked in and nothing is owing on a room. To charge a guest&apos;s room, open an invoice or a POS order and choose &quot;Post to room&quot;.
        </div>
      )}

      <div className="space-y-4">
        {reservations.map((r) => {
          const open = r.folioCharges.filter((c) => c.status === "OPEN");
          const balance = open.reduce((s, c) => s + Number(c.amount), 0);
          return (
            <section key={r.id} className="rounded-lg border bg-background">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                <div>
                  <p className="font-semibold">
                    Room {r.room.name} · {r.guest.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {date(r.checkIn)} – {date(r.checkOut)} · {r.status.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase text-muted-foreground">Balance due</p>
                  <p className="text-lg font-semibold">{money(balance)}</p>
                </div>
              </div>

              {r.folioCharges.length > 0 ? (
                <TableScroll><table className="w-full text-sm">
                  <tbody>
                    {r.folioCharges.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          {c.description}
                          {c.quantity > 1 ? ` × ${c.quantity}` : ""}
                          {c.category && <span className="block text-xs text-muted-foreground">{c.category}</span>}
                        </td>
                        <td className="px-4 py-2 text-right">{money(Number(c.amount))}</td>
                        <td className="w-28 px-4 py-2 text-right text-xs">
                          {c.status === "PAID" ? <span className="text-emerald-700">Paid</span> : <VoidChargeButton storeSlug={slug} chargeId={c.id} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></TableScroll>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">Nothing charged to this room yet.</p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 border-t p-3">
                <a
                  href={`/receipts/${slug}/folio/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Printer className="h-3.5 w-3.5" /> Print room bill
                </a>
                {open.length > 0 && <SettleFolioButton storeSlug={slug} reservationId={r.id} />}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
