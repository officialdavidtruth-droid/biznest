import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { getFnbDashboard } from "@/lib/actions/fnb";
import { listBookings, listReservationUnits } from "@/lib/actions/booking";
import { FnbWorkspace } from "@/components/dashboard/fnb-workspace";

export default async function FnbPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, businessType: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "fnb-operations");
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);
  if (!["Restaurant", "Food & Groceries"].includes(store.businessType)) notFound();
  const data = await getFnbDashboard(slug);
  if (!data) notFound();
  const [bookingRows, reservationUnits] = await Promise.all([listBookings(slug), listReservationUnits(slug)]);
  const reservations = bookingRows.map((b) => ({ id: b.id, scheduledAt: b.scheduledAt.toString(), status: b.status, partySize: b.partySize, specialRequests: b.specialRequests, guestName: b.buyer?.name ?? b.guestName ?? "Walk-in guest", guestPhone: b.buyer?.phone ?? b.guestPhone ?? "", unitId: b.unitId, unitLabel: b.unit?.label ?? null }));
  const units = reservationUnits.map((u) => ({ id: u.id, label: u.label, location: u.location, capacity: u.capacity }));
  return <FnbWorkspace slug={slug} data={data} reservations={reservations} units={units} />;
}
