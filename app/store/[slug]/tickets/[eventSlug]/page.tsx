// Route: /store/[slug]/tickets/[eventSlug]
// Public event page: details, ticket types with live availability, and the buy form.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { eventOpenForSale, tierAvailable, tierState } from "@/lib/tickets";
import { TicketBuyForm } from "@/components/storefront/ticket-buy-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; eventSlug: string }> }): Promise<Metadata> {
  const { slug, eventSlug } = await params;
  const ev = await prisma.ticketEvent.findFirst({ where: { slug: eventSlug, store: { slug }, status: { in: ["PUBLISHED", "CLOSED"] } }, select: { title: true, description: true } });
  return ev ? { title: ev.title, description: ev.description?.slice(0, 160) } : { title: "Event" };
}

export default async function EventTicketsPage({ params, searchParams }: { params: Promise<{ slug: string; eventSlug: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { slug, eventSlug } = await params;
  const { payment: flag } = await searchParams;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const ev = await prisma.ticketEvent.findFirst({ where: { storeId: store.id, slug: eventSlug, status: { in: ["PUBLISHED", "CLOSED", "CANCELLED"] } }, include: { tiers: { where: { active: true }, orderBy: { price: "asc" } } } });
  if (!ev) notFound();
  const palette = resolveStorePalette(store);
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };
  const colors = { accent: palette.accent, onAccent: palette.onAccent, ink: palette.ink };
  const now = new Date();
  const open = eventOpenForSale(ev, now);
  const tiers = ev.tiers.map((t) => ({ id: t.id, name: t.name, price: Number(t.price), left: tierAvailable(t), max: t.maxPerOrder, state: tierState({ id: t.id, name: t.name, price: Number(t.price), capacity: t.capacity, sold: t.sold, maxPerOrder: t.maxPerOrder, saleEndsAt: t.saleEndsAt, active: t.active }, now) }));
  const date = ev.startsAt.toLocaleString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 560 }} className="mx-auto px-6 py-12">
        <p className="text-sm font-semibold" style={{ opacity: 0.7 }}>{store.name}</p>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-1 text-3xl font-extrabold">{ev.title}</h1>
        <p className="mt-2 text-sm" style={{ opacity: 0.8 }}>{date}{ev.venue ? ` · ${ev.venue}` : ""}</p>
        {ev.imageUrl && /^https:\/\//.test(ev.imageUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ev.imageUrl} alt="" className="mt-4 w-full rounded-2xl object-cover" style={{ maxHeight: 280 }} />
        )}
        {ev.description && <p className="mt-4 whitespace-pre-line text-sm" style={{ opacity: 0.85 }}>{ev.description}</p>}
        {flag === "failed" && <p role="alert" className="mt-4 rounded-2xl p-4 text-sm" style={card}>That payment didn&rsquo;t go through. You haven&rsquo;t been charged. You can try again below.</p>}
        <section className="mt-6 rounded-2xl p-6" style={card} aria-label="Tickets">
          <p className="text-sm font-bold">Tickets</p>
          {ev.status === "CANCELLED" ? <p className="mt-2 text-sm">This event was cancelled.</p>
            : !open ? <p className="mt-2 text-sm">Ticket sales for this event are closed.</p>
            : tiers.length === 0 ? <p className="mt-2 text-sm">No tickets are on sale yet.</p>
            : <TicketBuyForm slug={slug} eventId={ev.id} tiers={tiers} colors={colors} />}
        </section>
      </main>
    </div>
  );
}
