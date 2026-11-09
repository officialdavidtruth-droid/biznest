import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils/format-money";
import { TableScroll } from "@/components/ui/table-scroll";

export default async function SubscriptionsOverview() {
  const [plans, stores] = await Promise.all([
    prisma.subscription.findMany({ orderBy: { price: "asc" } }),
    prisma.store.findMany({
      include: { subscription: true, business: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const byPlan = new Map<string, number>();
  for (const s of stores) {
    const key = s.subscription?.name ?? "Free";
    byPlan.set(key, (byPlan.get(key) ?? 0) + 1);
  }

  // Only the plans offered on the public home page get a card. Stores still on an older plan are counted together
  // and marked in the table, so none of them disappear from view.
  const activePlans = plans.filter((p) => p.isActive);
  const activeNames = new Set(activePlans.map((p) => p.name));
  const onOlderPlan = stores.filter((s) => !activeNames.has(s.subscription?.name ?? "Free")).length;

  const mrr = stores.reduce((sum, s) => sum + Number(s.subscription?.price ?? 0), 0);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Subscriptions</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground">MRR</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(mrr)}</p>
        </div>
        {activePlans.map((p) => (
          <div key={p.id} className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground">{p.name}</p>
            <p className="mt-1 text-2xl font-semibold">{byPlan.get(p.name) ?? 0}</p>
          </div>
        ))}
        {onOlderPlan > 0 && (
          <div className="rounded-lg border border-dashed bg-background p-4">
            <p className="text-xs text-muted-foreground">On an older plan</p>
            <p className="mt-1 text-2xl font-semibold">{onOlderPlan}</p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <TableScroll>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Store</th><th className="px-4 py-2">Owner</th><th className="px-4 py-2">Plan</th><th className="px-4 py-2">Domain</th></tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.business.user.email}</td>
                <td className="px-4 py-3">{s.subscription?.name ?? "Free"}{!activeNames.has(s.subscription?.name ?? "Free") && <span className="ml-2 text-xs text-muted-foreground">older plan</span>}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.customDomain ?? "—"}</td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No stores yet.</td></tr>
            )}
          </tbody>
        </table>
        </TableScroll>
      </div>
    </div>
  );
}
