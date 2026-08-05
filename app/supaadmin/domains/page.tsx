import { prisma } from "@/lib/prisma";
import { markDomainVerifiedManually } from "@/lib/actions/admin";

const STATUS_STYLE: Record<string, string> = {
  VERIFIED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-destructive/10 text-destructive",
  NONE: "bg-muted text-muted-foreground",
};

export default async function DomainsOverview() {
  const stores = await prisma.store.findMany({
    where: { customDomain: { not: null } },
    include: { subscription: true, business: { include: { user: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">Custom domains</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every store that has connected its own domain. Vercel handles DNS verification
        automatically — use "Mark verified" only if a vendor confirms their DNS is live but
        the status is stuck (e.g. the Vercel API check failed transiently).
      </p>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Store</th><th className="px-4 py-2">Domain</th><th className="px-4 py-2">Plan</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.customDomain}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.subscription?.name ?? "Free"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[s.customDomainStatus]}`}>{s.customDomainStatus}</span>
                </td>
                <td className="px-4 py-3">
                  {s.customDomainStatus !== "VERIFIED" && (
                    <form action={markDomainVerifiedManually.bind(null, s.id)}>
                      <button className="text-xs font-medium text-primary hover:underline">Mark verified</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No custom domains connected yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
