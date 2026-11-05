// Route: /store/[slug]/rent/[token]
// A tenant's own rent account. Reachable only with the unguessable portal link the landlord sends, so it needs no
// sign-in. It shows what is owed, lets the tenant pay online, shows receipts and takes repair requests.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { formatMoney } from "@/lib/utils/format-money";
import { whatsappLink } from "@/lib/utils/whatsapp-link";
import { NO_INDEX } from "@/lib/seo";
import { chargeState, summariseCharges } from "@/lib/real-estate";
import { RentPayButton, MaintenanceForm } from "@/components/storefront/rent-portal-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My rent", robots: NO_INDEX };

const fmtDate = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

export default async function RentPortalPage({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { slug, token } = await params;
  const { payment: paymentFlag } = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();

  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const unit = await prisma.realEstateUnit.findUnique({
    where: { portalToken: token },
    include: {
      property: { select: { storeId: true, name: true, address: true } },
      rentCharges: { where: { status: { not: "VOID" } }, orderBy: { dueDate: "asc" }, take: 120 },
      maintenanceRequests: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, title: true, status: true, createdAt: true } },
    },
  });
  if (!unit || unit.property.storeId !== store.id || !unit.tenantName) notFound();

  const palette = resolveStorePalette(store);
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };
  const now = new Date();
  const sum = summariseCharges(unit.rentCharges, now);
  const money = (n: number) => formatMoney(n, "NGN");
  const social = (store.socialLinks && typeof store.socialLinks === "object" ? store.socialLinks : {}) as Record<string, string | undefined>;
  const chat = whatsappLink(social.whatsapp || store.contactPhone, `Hi ${store.name}, about my rent for ${unit.property.name} ${unit.unitNo}.`);
  const colors = { accent: palette.accent, onAccent: palette.onAccent, ink: palette.ink };
  const STATUS_LABEL: Record<string, string> = { OPEN: "Received", IN_PROGRESS: "In progress", DONE: "Fixed", CANCELLED: "Closed" };

  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 560 }} className="mx-auto px-6 py-12">
        <p className="text-sm font-semibold" style={{ opacity: 0.7 }}>{store.name}</p>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-1 text-3xl font-extrabold">Hi {unit.tenantName.split(" ")[0]}</h1>
        <p className="mt-2 text-sm" style={{ opacity: 0.75 }}>{unit.property.name}, unit {unit.unitNo}{unit.property.address ? ` · ${unit.property.address}` : ""}</p>

        {paymentFlag === "success" && <p role="status" className="mt-4 rounded-2xl p-4 text-sm font-semibold" style={card}>Payment received. Your receipt is below. Thank you!</p>}
        {paymentFlag === "failed" && <p role="alert" className="mt-4 rounded-2xl p-4 text-sm" style={card}>That payment didn&rsquo;t go through. You haven&rsquo;t been charged. You can try again below.</p>}

        <section className="mt-8 rounded-2xl p-6" style={card} aria-label="Balance">
          <p className="text-sm" style={{ opacity: 0.7 }}>{sum.outstanding > 0 ? "Outstanding" : "You are up to date"}</p>
          <p className="mt-1 text-3xl font-extrabold">{money(sum.outstanding)}</p>
          {sum.overdue > 0 && <p className="mt-1 text-sm font-semibold" style={{ color: "#b91c1c" }}>{money(sum.overdue)} is overdue</p>}
        </section>

        <section className="mt-4 rounded-2xl p-6" style={card} aria-label="Charges">
          <p className="text-sm font-bold">Rent and charges</p>
          {unit.rentCharges.length === 0 && <p className="mt-2 text-sm" style={{ opacity: 0.7 }}>Nothing has been billed yet.</p>}
          <ul className="mt-3 space-y-4">
            {unit.rentCharges.map((c) => {
              const st = chargeState(c, now);
              return (
                <li key={c.id} className="text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{c.label}</p>
                      <p className="text-xs" style={{ opacity: 0.7 }}>
                        {st === "PAID" ? `Paid ${c.paidAt ? fmtDate(c.paidAt) : ""}${c.receiptNo ? ` · Receipt ${c.receiptNo}` : ""}` : `Due ${fmtDate(c.dueDate)}${st === "OVERDUE" ? " · Overdue" : ""}`}
                      </p>
                    </div>
                    <b>{money(Number(c.amount))}</b>
                  </div>
                  {c.status === "DUE" && <RentPayButton slug={slug} token={token} chargeId={c.id} colors={colors} />}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-4 rounded-2xl p-6" style={card} aria-label="Repairs">
          <p className="text-sm font-bold">Repairs</p>
          {unit.maintenanceRequests.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm">
              {unit.maintenanceRequests.map((m) => (
                <li key={m.id} className="flex justify-between gap-3"><span>{m.title}</span><span style={{ opacity: 0.7 }}>{STATUS_LABEL[m.status] ?? m.status}</span></li>
              ))}
            </ul>
          )}
          <MaintenanceForm slug={slug} token={token} colors={colors} />
        </section>

        {chat && (
          <a href={chat} target="_blank" rel="noopener noreferrer" className="mt-6 block rounded-full py-3 text-center text-sm font-semibold no-underline" style={{ background: palette.accent, color: palette.onAccent }}>
            Message {store.name} on WhatsApp
          </a>
        )}
      </main>
    </div>
  );
}
