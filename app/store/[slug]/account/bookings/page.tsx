import { notFound } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { listStoreBookings } from "@/lib/actions/account";
import { PayBookingWithWalletButton } from "@/components/storefront/pay-booking-wallet-button";
import { WalletPaymentQrButton } from "@/components/storefront/wallet-payment-qr-button";
import { getAccountCopy } from "@/lib/account-copy";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function formatTime(value: Date | string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBranding(slug);
  if (!store) notFound();
  const bookings = await listStoreBookings(slug);
  const record = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } });
  const copy = getAccountCopy(record?.template?.name, store.businessCategory);
  const upcoming = bookings.filter(b => b.status !== "CANCELLED" && new Date(b.checkOut ?? b.scheduledAt) >= new Date());
  const past = bookings.filter(b => !upcoming.some(u => u.id === b.id));

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Your {copy.bookings.toLowerCase()}</p>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-950">{copy.bookings}</h1>
        <p className="mt-2 text-sm text-slate-500">Manage your {copy.bookings.toLowerCase()} with {store.name}.</p>
      </div>

      <div className="max-w-4xl">
        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-900">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map(b => <article key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="font-bold text-slate-950">{b.service.name}</p><p className="mt-1 text-sm text-slate-500">{b.checkIn && b.checkOut ? `${formatDate(b.checkIn)} → ${formatDate(b.checkOut)}` : `${formatDate(b.scheduledAt)} at ${formatTime(b.scheduledAt)}`}</p>{b.staff && <p className="mt-1 text-xs text-slate-400">With {b.staff.user?.name || b.staff.invitedName || b.staff.position || "your specialist"}</p>}</div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${b.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{b.status}</span>
              </div>
              {b.notes && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{b.notes}</p>}
              {b.paymentStatus !== "PAID" && (
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <PayBookingWithWalletButton slug={slug} bookingId={b.id} />
                  <WalletPaymentQrButton slug={slug} bookingId={b.id} />
                </div>
              )}
              <div className="mt-4 flex items-center justify-between border-t pt-4 text-xs text-slate-400"><span>Booking #{b.id.slice(-7).toUpperCase()}</span><span>{b.checkIn && b.checkOut ? "Reservation" : `${b.durationMins} min appointment`}</span></div>
            </article>)}
            {upcoming.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No upcoming bookings. Find a service on the website to make one.</div>}
          </div>
        </section>

        {past.length > 0 && <section className="mt-10"><h2 className="mb-3 text-sm font-bold text-slate-900">Booking history</h2><div className="space-y-2">{past.map(b => <div key={b.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"><div><p className="text-sm font-semibold text-slate-800">{b.service.name}</p><p className="mt-1 text-xs text-slate-400">{formatDate(b.scheduledAt)}</p></div><span className="text-xs font-semibold text-slate-500">{b.status}</span></div>)}</div></section>}
      </div>
    </div>
  );
}
