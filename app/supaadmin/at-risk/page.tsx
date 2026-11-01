import Link from "next/link";
import { listAtRiskStores } from "@/lib/actions/admin";
import { formatDate } from "@/lib/i18n/locale";
import { TableScroll } from "@/components/ui/table-scroll";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  NO_LOGIN: "No login",
  NO_ORDERS: "No orders",
  PAYMENT_FAILED: "Payment failed",
  UNUSED_PLUGIN: "Unused app",
};

export default async function AtRiskPage() {
  const groups = await listAtRiskStores();
  if (!groups) return <p className="text-sm text-muted-foreground">Not authorized.</p>;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">At-risk stores</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Stores showing early warning signs. Owners were already nudged once in-app and by email, so a personal message from you lands next.
      </p>
      <div className="overflow-hidden rounded-lg border bg-background">
        <TableScroll>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Store</th>
                <th className="px-4 py-2">Warning signs</th>
                <th className="px-4 py-2">Contact</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(({ store, signals }) => (
                <tr key={store.id} className="border-b align-top last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/${store.slug}`} target="_blank" className="font-medium text-primary hover:underline">{store.name}</Link>
                    <p className="text-xs text-muted-foreground">/{store.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-1">
                      {signals.map((s) => (
                        <li key={s.id}>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{LABEL[s.kind] ?? s.kind}</span>{" "}
                          <span className="text-muted-foreground">{s.detail} · since {formatDate(s.firstDetectedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p>{store.business.user.email}</p>
                    {store.business.phone && <p className="text-xs">{store.business.phone}</p>}
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">No at-risk stores right now.</td></tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </div>
  );
}
