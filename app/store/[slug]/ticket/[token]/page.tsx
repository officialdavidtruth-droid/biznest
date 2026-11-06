// Route: /store/[slug]/ticket/[token]
// The buyer's tickets, each with a QR code to show at the gate. Reachable only with the unguessable link emailed to the buyer.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { NO_INDEX } from "@/lib/seo";
import { formatMoney } from "@/lib/utils/format-money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My tickets", robots: NO_INDEX };

export default async function MyTicketsPage({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { slug, token } = await params;
  const { payment: flag } = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const order = await prisma.ticketOrder.findUnique({
    where: { accessToken: token },
    include: { event: true, tickets: { orderBy: { createdAt: "asc" }, include: { tier: { select: { name: true } } } } },
  });
  if (!order || order.storeId !== store.id) notFound();

  const palette = resolveStorePalette(store);
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };
  const paid = order.status === "PAID";
  const qrs = paid ? await Promise.all(order.tickets.map((t) => QRCode.toDataURL(t.code, { margin: 1, width: 240, errorCorrectionLevel: "M" }))) : [];
  const date = order.event.startsAt.toLocaleString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 480 }} className="mx-auto px-6 py-12">
        <p className="text-sm font-semibold" style={{ opacity: 0.7 }}>{store.name}</p>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-1 text-2xl font-extrabold">{order.event.title}</h1>
        <p className="mt-1 text-sm" style={{ opacity: 0.8 }}>{date}{order.event.venue ? ` · ${order.event.venue}` : ""}</p>
        {flag === "success" && paid && <p role="status" className="mt-4 rounded-2xl p-4 text-sm font-semibold" style={card}>Payment received. Your tickets are below, and we&rsquo;ve emailed you a link.</p>}
        {order.status === "PENDING" && <p role="status" className="mt-4 rounded-2xl p-4 text-sm" style={card}>We&rsquo;re waiting for your payment to be confirmed. Refresh this page in a minute. Your tickets appear here once it clears.</p>}
        {order.status === "CANCELLED" && <p role="alert" className="mt-4 rounded-2xl p-4 text-sm" style={card}>This order was cancelled.</p>}
        {order.event.status === "CANCELLED" && <p role="alert" className="mt-4 rounded-2xl p-4 text-sm font-semibold" style={card}>This event was cancelled. Please contact {store.name} about a refund.</p>}
        {paid && (
          <>
            <ul className="mt-6 space-y-4">
              {order.tickets.map((t, i) => (
                <li key={t.id} className="rounded-2xl p-5 text-center" style={card}>
                  <p className="text-sm font-bold">{t.tier.name}{t.holderName ? ` · ${t.holderName}` : ""}</p>
                  {t.status === "VOID" ? <p className="mt-3 text-sm font-semibold" style={{ color: "#b91c1c" }}>Cancelled</p> : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrs[i]} alt={`QR code for ticket ${i + 1}`} width={240} height={240} className="mx-auto mt-3 rounded-lg bg-white p-2" />
                      <p className="mt-2 font-mono text-sm tracking-widest">{t.code.replace(/(.{4})/g, "$1 ").trim()}</p>
                      {t.status === "CHECKED_IN" && <p className="mt-1 text-xs font-semibold" style={{ opacity: 0.7 }}>Used</p>}
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs" style={{ opacity: 0.7 }}>{Number(order.total) > 0 ? `Paid ${formatMoney(Number(order.total), "NGN")}` : "Free ticket"}{order.receiptNo ? ` · Receipt ${order.receiptNo}` : ""}. Show a QR code at the entrance; each one works once.</p>
          </>
        )}
      </main>
    </div>
  );
}
