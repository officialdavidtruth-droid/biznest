// Route: /store/[slug]/admin/delivery
import { prisma } from "@/lib/prisma";
import { DeliveryZoneForm } from "@/components/dashboard/delivery-zone-form";
import { DeliveryZoneRow } from "@/components/dashboard/delivery-zone-row";

export default async function DeliveryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const zones = await prisma.deliveryZone.findMany({
    where: { storeId: store.id },
    orderBy: [{ city: "asc" }, { fee: "asc" }],
  });

  // Store-level display currency (not whichever product happens to come first).
  const currency = store.currency;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Delivery zones</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Define local areas you deliver to and what each costs — group them by city for
        multi-city coverage (e.g. Abuja: Gwarinpa, Wuse, Maitama…). Buyers must pick
        one of your active areas at checkout, or choose pickup instead. If you
        deactivate every zone, delivery is paused and buyers can only pick up.
      </p>

      <DeliveryZoneForm storeSlug={slug} currency={currency} />

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">City</th>
              <th className="px-4 py-2">Zone</th>
              <th className="px-4 py-2">Fee</th>
              <th className="px-4 py-2">ETA</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <DeliveryZoneRow key={z.id} storeSlug={slug} currency={currency} zone={{ ...z, fee: Number(z.fee) }} />
            ))}
            {zones.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No zones yet — add one above. Until then, checkout won't add a delivery fee.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
