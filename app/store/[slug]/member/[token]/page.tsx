// Route: /store/[slug]/member/[token]
// A member's own account. Reachable only with the unguessable link the store sends, so it needs no sign-in.
// Shows what is owed, lets the member pay online, and lists plans, receipts and recent visits.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { formatMoney } from "@/lib/utils/format-money";
import { whatsappLink } from "@/lib/utils/whatsapp-link";
import { NO_INDEX } from "@/lib/seo";
import { chargeState, membershipState, summariseCharges } from "@/lib/members";
import { MemberPayButton } from "@/components/storefront/member-portal-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: NO_INDEX };

const fmtDate = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const STATE: Record<string, string> = { ACTIVE: "Active", EXPIRING: "Ending soon", EXPIRED: "Expired", USED_UP: "All sessions used", PAUSED: "Paused", CANCELLED: "Cancelled", NOT_STARTED: "Starts soon" };

export default async function MemberPortalPage({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { slug, token } = await params;
  const { payment: paymentFlag } = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();

  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const member = await prisma.member.findUnique({
    where: { portalToken: token },
    include: {
      memberships: { where: { status: { not: "CANCELLED" } }, include: { plan: { select: { name: true } } }, orderBy: { startsAt: "desc" }, take: 10 },
      charges: { where: { status: { not: "VOID" } }, orderBy: { dueDate: "desc" }, take: 120 },
      checkIns: { orderBy: { at: "desc" }, take: 5, select: { id: true, at: true } },
    },
  });
  if (!member || member.storeId !== store.id || !member.active) notFound();

  const palette = resolveStorePalette(store);
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };
  const now = new Date();
  const sum = summariseCharges(member.charges, now);
  const money = (n: number) => formatMoney(n, "NGN");
  const social = (store.socialLinks && typeof store.socialLinks === "object" ? store.socialLinks : {}) as Record<string, string | undefined>;
  const chat = whatsappLink(social.whatsapp || store.contactPhone, `Hi ${store.name}, about my account.`);
  const colors = { accent: palette.accent, onAccent: palette.onAccent, ink: palette.ink };

  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 560 }} className="mx-auto px-6 py-12">
        <p className="text-sm font-semibold" style={{ opacity: 0.7 }}>{store.name}</p>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-1 text-3xl font-extrabold">Hi {member.name.split(" ")[0]}</h1>

        {paymentFlag === "success" && <p role="status" className="mt-4 rounded-2xl p-4 text-sm font-semibold" style={card}>Payment received. Your receipt is below. Thank you!</p>}
        {paymentFlag === "failed" && <p role="alert" className="mt-4 rounded-2xl p-4 text-sm" style={card}>That payment didn&rsquo;t go through. You haven&rsquo;t been charged. You can try again below.</p>}

        <section className="mt-8 rounded-2xl p-6" style={card} aria-label="Balance">
          <p className="text-sm" style={{ opacity: 0.7 }}>{sum.outstanding > 0 ? "Outstanding" : "You are up to date"}</p>
          <p className="mt-1 text-3xl font-extrabold">{money(sum.outstanding)}</p>
          {sum.overdue > 0 && <p className="mt-1 text-sm font-semibold" style={{ color: "#b91c1c" }}>{money(sum.overdue)} is overdue</p>}
        </section>

        {member.memberships.length > 0 && (
          <section className="mt-4 rounded-2xl p-6" style={card} aria-label="Plans">
            <p className="text-sm font-bold">My plans</p>
            <ul className="mt-3 space-y-3 text-sm">
              {member.memberships.map((m) => (
                <li key={m.id} className="flex justify-between gap-3">
                  <span className="font-semibold">{m.plan.name}</span>
                  <span className="text-right text-xs" style={{ opacity: 0.75 }}>
                    {STATE[membershipState(m, now)]}
                    {m.sessionsLeft !== null ? ` · ${m.sessionsLeft} session${m.sessionsLeft === 1 ? "" : "s"} left` : ""}
                    {m.renewsAt ? ` · renews ${fmtDate(m.renewsAt)}` : ""}
                    {m.endsAt ? ` · until ${fmtDate(m.endsAt)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-4 rounded-2xl p-6" style={card} aria-label="Charges">
          <p className="text-sm font-bold">Payments</p>
          {member.charges.length === 0 && <p className="mt-2 text-sm" style={{ opacity: 0.7 }}>Nothing has been billed yet.</p>}
          <ul className="mt-3 space-y-4">
            {member.charges.map((c) => {
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
                  {c.status === "DUE" && <MemberPayButton slug={slug} token={token} chargeId={c.id} colors={colors} />}
                </li>
              );
            })}
          </ul>
        </section>

        {member.checkIns.length > 0 && (
          <section className="mt-4 rounded-2xl p-6" style={card} aria-label="Visits">
            <p className="text-sm font-bold">Recent visits</p>
            <ul className="mt-2 space-y-1 text-xs" style={{ opacity: 0.8 }}>{member.checkIns.map((c) => <li key={c.id}>{fmtDate(c.at)}</li>)}</ul>
          </section>
        )}

        {chat && (
          <a href={chat} target="_blank" rel="noopener noreferrer" className="mt-6 block rounded-full py-3 text-center text-sm font-semibold no-underline" style={{ background: palette.accent, color: palette.onAccent }}>
            Message {store.name} on WhatsApp
          </a>
        )}
      </main>
    </div>
  );
}
