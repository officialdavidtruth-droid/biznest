// Route: /store/[slug]/track/[token]
// A customer's delivery tracking page. The link is the credential. Shows progress, the rider's first name and the
// 4-digit code to give the rider at the door.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { NO_INDEX } from "@/lib/seo";
import { statusLabel, isOpen } from "@/lib/dispatch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Track delivery", robots: NO_INDEX };

export default async function TrackPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const d = await prisma.delivery.findUnique({ where: { trackToken: token }, include: { rider: { select: { name: true, phone: true } }, events: { orderBy: { at: "asc" } } } });
  if (!d || d.storeId !== store.id) notFound();

  const palette = resolveStorePalette(store);
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };
  const label = statusLabel(d.status);
  const t = (x: Date) => x.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 480 }} className="mx-auto px-6 py-12">
        <p className="text-sm font-semibold" style={{ opacity: 0.7 }}>{store.name}</p>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-1 text-2xl font-extrabold">Delivery {d.jobNo}</h1>
        <section className="mt-6 rounded-2xl p-6" style={card}>
          <p className="text-sm" style={{ opacity: 0.7 }}>Status</p>
          <p className="mt-1 text-2xl font-extrabold">{label}</p>
          {d.rider && d.status !== "NEW" && <p className="mt-1 text-sm">Rider: {d.rider.name.split(" ")[0]}{d.rider.phone && isOpen(d.status) ? <> · <a href={`tel:${d.rider.phone}`}>{d.rider.phone}</a></> : null}</p>}
          {d.status === "FAILED" && d.failureReason && <p className="mt-2 text-sm" style={{ color: "#b91c1c" }}>{d.failureReason}</p>}
        </section>
        {(d.status === "ASSIGNED" || d.status === "PICKED_UP") && (
          <section className="mt-4 rounded-2xl p-6 text-center" style={card} aria-label="Delivery code">
            <p className="text-sm font-bold">Your delivery code</p>
            <p className="mt-2 text-4xl font-extrabold tracking-[0.4em]">{d.deliveryPin}</p>
            <p className="mt-2 text-xs" style={{ opacity: 0.7 }}>Give this to the rider only when you have your package. It confirms delivery.</p>
            {Number(d.codAmount) > 0 && <p className="mt-3 text-sm font-semibold">Please have ₦{Math.round(Number(d.codAmount)).toLocaleString("en-NG")} ready.</p>}
          </section>
        )}
        <section className="mt-4 rounded-2xl p-6 text-sm" style={card}>
          <p><b>From:</b> {d.pickupAddress}</p>
          <p className="mt-1"><b>To:</b> {d.dropoffAddress}</p>
          {d.itemDescription && <p className="mt-1"><b>Item:</b> {d.itemDescription}</p>}
          {d.status === "DELIVERED" && d.deliveredAt && <p className="mt-1"><b>Delivered:</b> {t(d.deliveredAt)}{d.recipientName ? ` · received by ${d.recipientName}` : ""}</p>}
        </section>
        <section className="mt-4 rounded-2xl p-6" style={card} aria-label="History">
          <p className="text-sm font-bold">History</p>
          <ul className="mt-2 space-y-2 text-xs">
            {d.events.map((e) => <li key={e.id} className="flex justify-between gap-3"><span>{statusLabel(e.status)}{e.note ? ` · ${e.note}` : ""}</span><span style={{ opacity: 0.7 }}>{t(e.at)}</span></li>)}
          </ul>
        </section>
      </main>
    </div>
  );
}
