// Route: /store/[slug]/admin/services
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getBusinessTerminology } from "@/lib/business-terminology";
import { ServicesTable } from "@/components/dashboard/services-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Wrench, CheckCircle2, CalendarClock, Plus } from "lucide-react";

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: { select: { category: true } } } });
  if (!store) return null;
  const terminology = getBusinessTerminology(store.business.category);

  const services = await prisma.service.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" } });
  const activeCount = services.filter((s) => s.isPublished).length;
  const bookableCount = services.filter((s) => s.isBookable).length;

  return (
    <div className="bn-admin-page space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{terminology.catalog}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{terminology.catalogDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${slug}`} target="_blank" className="bn-admin-action rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold">View Store ↗</Link>
          <Link href={`/${slug}/admin/services/new`} className="bn-admin-action rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="mr-2 inline h-4 w-4" />Add {terminology.catalogSingular}</Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Wrench} tone="purple" label={`Total ${terminology.catalog}`} value={services.length} note="All entries" />
        <StatCard icon={CheckCircle2} tone="green" label={`Active ${terminology.catalog}`} value={activeCount} note="Published and visible" />
        <StatCard icon={CalendarClock} tone="orange" label="Bookable" value={bookableCount} note="Accepting bookings" />
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4"><h2 className="text-base font-bold">{terminology.catalog}</h2><p className="mt-1 text-xs text-muted-foreground">Manage your {terminology.catalog.toLowerCase()} and their availability</p></div>
        <ServicesTable
          storeSlug={slug}
          services={services.map((s) => ({
            id: s.id, name: s.name, price: Number(s.price), currency: s.currency,
            isBookable: s.isBookable, durationMins: s.durationMins, isPublished: s.isPublished,
          }))}
          terminology={terminology}
        />
      </section>
    </div>
  );
}
