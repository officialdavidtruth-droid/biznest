import { prisma } from "@/lib/prisma";

export default async function SubscriptionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true } });
  if (!store) return null;

  const plans = await prisma.subscription.findMany({ orderBy: { price: "asc" } });

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">Subscription</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Current plan: <strong>{store.subscription?.name ?? "Free"}</strong> · {Number(store.subscription?.commissionRate ?? 8)}% commission per sale
      </p>

      <div className="grid gap-4 sm:grid-cols-4">
        {plans.map((p) => {
          const isCurrent = p.id === store.subscriptionId;
          return (
            <div key={p.id} className={`rounded-lg border bg-background p-4 ${isCurrent ? "border-primary ring-1 ring-primary" : ""}`}>
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-2xl font-semibold">₦{Number(p.price).toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/{p.interval.toLowerCase()}</span></p>
              <p className="mt-2 text-xs text-muted-foreground">{Number(p.commissionRate)}% commission</p>
              {isCurrent ? (
                <span className="mt-3 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Current plan</span>
              ) : (
                <button className="mt-3 w-full rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">Switch plan</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
