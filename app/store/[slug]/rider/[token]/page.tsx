// Route: /store/[slug]/rider/[token]
// A rider's own job list, opened from the link the dispatcher sends. No sign-in; the link is the credential.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { NO_INDEX } from "@/lib/seo";
import { statusLabel } from "@/lib/dispatch";
import { RiderJobActions } from "@/components/storefront/rider-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My deliveries", robots: NO_INDEX };

export default async function RiderPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const rider = await prisma.rider.findUnique({ where: { accessToken: token } });
  if (!rider || !rider.active || rider.storeId !== store.id) notFound();
  const jobs = await prisma.delivery.findMany({ where: { riderId: rider.id, status: { in: ["ASSIGNED", "PICKED_UP"] } }, orderBy: { createdAt: "asc" }, take: 50 });

  const palette = resolveStorePalette(store);
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };
  const colors = { accent: palette.accent, onAccent: palette.onAccent, ink: palette.ink };
  const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 480 }} className="mx-auto px-5 py-10">
        <p className="text-sm font-semibold" style={{ opacity: 0.7 }}>{store.name}</p>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-1 text-2xl font-extrabold">Hi {rider.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm" style={{ opacity: 0.75 }}>{jobs.length === 0 ? "No deliveries right now. Refresh to check." : `${jobs.length} ${jobs.length === 1 ? "delivery" : "deliveries"} for you`}</p>
        <ul className="mt-6 space-y-4">
          {jobs.map((d) => (
            <li key={d.id} className="rounded-2xl p-5 text-sm" style={card}>
              <div className="flex justify-between gap-2"><b>{d.jobNo}</b><span style={{ opacity: 0.7 }}>{statusLabel(d.status)}</span></div>
              {d.itemDescription && <p className="mt-1" style={{ opacity: 0.8 }}>{d.itemDescription}</p>}
              <p className="mt-3 text-xs font-bold uppercase" style={{ opacity: 0.6 }}>Pick up</p>
              <p><a href={maps(d.pickupAddress)} target="_blank" rel="noopener noreferrer">{d.pickupAddress}</a>{d.pickupContact ? <> · <a href={`tel:${d.pickupContact}`}>{d.pickupContact}</a></> : null}</p>
              <p className="mt-3 text-xs font-bold uppercase" style={{ opacity: 0.6 }}>Deliver to {d.customerName}</p>
              <p><a href={maps(d.dropoffAddress)} target="_blank" rel="noopener noreferrer">{d.dropoffAddress}</a>{(d.dropoffContact || d.customerPhone) ? <> · <a href={`tel:${d.dropoffContact || d.customerPhone}`}>{d.dropoffContact || d.customerPhone}</a></> : null}</p>
              {Number(d.codAmount) > 0 && <p className="mt-3 font-bold">Collect ₦{Math.round(Number(d.codAmount)).toLocaleString("en-NG")} cash</p>}
              <RiderJobActions slug={slug} token={token} id={d.id} status={d.status} cod={Number(d.codAmount)} colors={colors} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
