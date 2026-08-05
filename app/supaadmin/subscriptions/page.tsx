import { prisma } from "@/lib/prisma";

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

  const mrr = stores.reduce((sum, s) => sum + Number(s.subscription?.price ?? 0), 0);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Subscriptions</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground">MRR</p>
          <p className="mt-1 text-2xl font-semibold">₦{mrr.toLocaleString()}</p>
        </div>
        {plans.map((p) => (
          <div key={p.id} className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground">{p.name}{!p.isActive && " (retired)"}</p>
            <p className="mt-1 text-2xl font-semibold">{byPlan.get(p.name) ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Store</th><th className="px-4 py-2">Owner</th><th className="px-4 py-2">Plan</th><th className="px-4 py-2">Domain</th></tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.business.user.email}</td>
                <td className="px-4 py-3">{s.subscription?.name ?? "Free"}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.customDomain ?? "—"}</td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No stores yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
