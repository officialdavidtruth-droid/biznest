// Route: /store/[slug]/tickets — upcoming events with tickets on sale.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events" };

export default async function TicketsIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const events = await prisma.ticketEvent.findMany({ where: { storeId: store.id, status: "PUBLISHED", startsAt: { gte: new Date(Date.now() - 24 * 3_600_000) } }, orderBy: { startsAt: "asc" }, take: 50 });
  const palette = resolveStorePalette(store);
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };
  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 560 }} className="mx-auto px-6 py-12">
        <p className="text-sm font-semibold" style={{ opacity: 0.7 }}>{store.name}</p>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-1 text-3xl font-extrabold">Upcoming events</h1>
        {events.length === 0 && <p className="mt-6 text-sm" style={{ opacity: 0.75 }}>No events on sale right now.</p>}
        <ul className="mt-6 space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/store/${slug}/tickets/${e.slug}`} className="block rounded-2xl p-5 no-underline" style={{ ...card, color: "inherit" }}>
                <b>{e.title}</b>
                <span className="mt-1 block text-xs" style={{ opacity: 0.75 }}>{e.startsAt.toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{e.venue ? ` · ${e.venue}` : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
