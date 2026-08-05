import { prisma } from "@/lib/prisma";
import { createDeliveryZone, toggleDeliveryZone } from "@/lib/actions/delivery-zone";

export default async function DeliveryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const zones = await prisma.deliveryZone.findMany({ where: { storeId: store.id }, orderBy: { fee: "asc" } });
  const createZone = createDeliveryZone.bind(null, slug);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Delivery zones</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Define local areas you deliver to and what each costs. Buyers pick one at checkout —
        no zone selected means no delivery fee is added.
      </p>

      <form action={createZone} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border bg-background p-4 sm:grid-cols-4">
        <input name="name" placeholder="e.g. Wuse & Garki" required className="rounded-md border px-3 py-1.5 text-sm sm:col-span-2" />
        <input name="fee" type="number" min="0" step="0.01" placeholder="Fee (₦)" required className="rounded-md border px-3 py-1.5 text-sm" />
        <input name="estimatedMinutes" type="number" min="0" placeholder="ETA (mins)" className="rounded-md border px-3 py-1.5 text-sm" />
        <button className="col-span-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground sm:col-span-4">Add zone</button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Zone</th><th className="px-4 py-2">Fee</th><th className="px-4 py-2">ETA</th><th className="px-4 py-2">Active</th></tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{z.name}</td>
                <td className="px-4 py-3">₦{Number(z.fee).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{z.estimatedMinutes ? `${z.estimatedMinutes} min` : "—"}</td>
                <td className="px-4 py-3">
                  <form action={toggleDeliveryZone.bind(null, slug, z.id, !z.isActive)}>
                    <button className={`rounded-full px-2 py-0.5 text-xs ${z.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {z.isActive ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No zones yet — add one above. Until then, checkout won't charge a delivery fee.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
