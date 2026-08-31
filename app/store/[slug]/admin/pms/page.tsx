import { notFound, redirect } from "next/navigation";
import { getPmsData, getPmsAccessStatus } from "@/lib/actions/pms";
import { prisma } from "@/lib/prisma";
import { PmsWorkspace } from "@/components/dashboard/pms-workspace";

export default async function PmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getPmsAccessStatus(slug);
  // A hotel that just isn't on Business Mogul yet should land on the
  // upgrade banner (subscription page already has copy for pms=upgrade),
  // not a bare 404 — the quick action / nav link that got them here made
  // it look like a real feature they can't reach, not a dead route.
  // Any other failure (wrong business type, wrong store, no access at
  // all) still 404s rather than advertising an upgrade path that
  // wouldn't even unlock PMS for them.
  if (!access.allowed) {
    if (access.error === "BizNest PMS is available exclusively on the Business Mogul plan.") {
      redirect(`/store/${slug}/admin/subscription?pms=upgrade`);
    }
    notFound();
  }
  const [data, store] = await Promise.all([
    getPmsData(slug),
    prisma.store.findUnique({ where: { slug }, select: { name: true } }),
  ]);
  if (!data || !store) notFound();
  return <PmsWorkspace slug={slug} storeName={store.name} rooms={data.rooms} guests={data.guests} reservations={data.reservations} />;
}
