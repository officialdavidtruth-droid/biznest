// Route: /store/[slug]/job/[token]
// A customer's job page: progress, updates and photos, the estimate to approve, what is owing and pay buttons, and the
// final deliverable (gallery or handover pack) once nothing is owing. The link is the credential.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { formatMoney } from "@/lib/utils/format-money";
import { whatsappLink } from "@/lib/utils/whatsapp-link";
import { NO_INDEX } from "@/lib/seo";
import { deliverableVisible, itemsTotal, outstanding, profileFor, progressPct, safeHttpsUrl, stageLabel } from "@/lib/jobs";
import { EstimateButtons, JobPayButton } from "@/components/storefront/job-portal-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My job", robots: NO_INDEX };

const fmt = (d: Date) => d.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function JobPage({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { slug, token } = await params;
  const { payment: flag } = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const job = await prisma.jobCard.findUnique({
    where: { accessToken: token },
    include: { items: { orderBy: { id: "asc" } }, charges: { where: { status: { not: "VOID" } }, orderBy: { createdAt: "asc" } }, updates: { orderBy: { at: "desc" }, take: 30 } },
  });
  if (!job || job.storeId !== store.id) notFound();

  const palette = resolveStorePalette(store);
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };
  const colors = { accent: palette.accent, onAccent: palette.onAccent, ink: palette.ink };
  const prof = profileFor(job.niche);
  const money = (n: number) => formatMoney(n, "NGN");
  const items = job.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) }));
  const total = itemsTotal(items);
  const owing = outstanding(job.charges);
  const pct = progressPct(job.niche, job.stage);
  const deliverable = job.deliverableUrl && safeHttpsUrl(job.deliverableUrl) && deliverableVisible(job.charges) && job.status === "DONE" ? job.deliverableUrl : null;
  const social = (store.socialLinks && typeof store.socialLinks === "object" ? store.socialLinks : {}) as Record<string, string | undefined>;
  const chat = whatsappLink(social.whatsapp || store.contactPhone, `Hi ${store.name}, about ${job.jobNo}.`);

  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 560 }} className="mx-auto px-6 py-12">
        <p className="text-sm font-semibold" style={{ opacity: 0.7 }}>{store.name}</p>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-1 text-2xl font-extrabold">{job.title}</h1>
        <p className="mt-1 text-sm" style={{ opacity: 0.75 }}>{job.jobNo}{job.subject ? ` · ${job.subject}` : ""}{job.subjectDetail ? ` · ${job.subjectDetail}` : ""}</p>
        {flag === "success" && <p role="status" className="mt-4 rounded-2xl p-4 text-sm font-semibold" style={card}>Payment received. Your receipt is below. Thank you!</p>}
        {flag === "failed" && <p role="alert" className="mt-4 rounded-2xl p-4 text-sm" style={card}>That payment didn&rsquo;t go through. You haven&rsquo;t been charged. You can try again below.</p>}
        {job.status === "CANCELLED" && <p role="alert" className="mt-4 rounded-2xl p-4 text-sm font-semibold" style={card}>This job was cancelled.</p>}

        <section className="mt-6 rounded-2xl p-6" style={card} aria-label="Progress">
          <p className="text-sm" style={{ opacity: 0.7 }}>Status</p>
          <p className="mt-1 text-xl font-extrabold">{stageLabel(job.niche, job.stage)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: `${palette.ink}14` }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%`, height: "100%", background: palette.accent }} /></div>
          <ol className="mt-3 flex justify-between gap-1 text-[10px]" style={{ opacity: 0.7 }}>{prof.stages.map((s) => <li key={s.key} className={s.key === job.stage ? "font-bold" : ""}>{s.label}</li>)}</ol>
        </section>

        {job.estimateStatus === "PENDING" && (
          <section className="mt-4 rounded-2xl p-6" style={card} aria-label="Estimate">
            <p className="text-sm font-bold">Please approve your estimate</p>
            <ul className="mt-3 space-y-1 text-sm">{items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.qty} × {i.label}</span><span>{money(i.qty * i.unitPrice)}</span></li>)}</ul>
            <p className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{money(total)}</span></p>
            <EstimateButtons slug={slug} token={token} colors={colors} />
          </section>
        )}
        {job.estimateStatus !== "PENDING" && items.length > 0 && (
          <section className="mt-4 rounded-2xl p-6" style={card} aria-label="Estimate">
            <p className="text-sm font-bold">Estimate {job.estimateStatus === "APPROVED" ? "(approved)" : job.estimateStatus === "DECLINED" ? "(declined)" : ""}</p>
            <ul className="mt-3 space-y-1 text-sm">{items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.qty} × {i.label}</span><span>{money(i.qty * i.unitPrice)}</span></li>)}</ul>
            <p className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{money(total)}</span></p>
          </section>
        )}

        {job.charges.length > 0 && (
          <section className="mt-4 rounded-2xl p-6" style={card} aria-label="Payments">
            <p className="text-sm font-bold">Payments {owing > 0 ? `· ${money(owing)} due` : "· all paid"}</p>
            <ul className="mt-3 space-y-4 text-sm">
              {job.charges.map((c) => (
                <li key={c.id}>
                  <div className="flex justify-between gap-3"><span><b>{c.label}</b><span className="block text-xs" style={{ opacity: 0.7 }}>{c.status === "PAID" ? `Paid${c.paidAt ? ` ${fmt(c.paidAt)}` : ""}${c.receiptNo ? ` · Receipt ${c.receiptNo}` : ""}` : "Due"}</span></span><b>{money(Number(c.amount))}</b></div>
                  {c.status === "DUE" && job.status !== "CANCELLED" && <JobPayButton slug={slug} token={token} chargeId={c.id} colors={colors} />}
                </li>
              ))}
            </ul>
          </section>
        )}

        {deliverable && (
          <a href={deliverable} target="_blank" rel="noopener noreferrer" className="mt-4 block rounded-full py-3 text-center text-sm font-semibold no-underline" style={{ background: palette.accent, color: palette.onAccent }}>Open your {prof.deliverableLabel?.toLowerCase() ?? "files"}</a>
        )}
        {job.deliverableUrl && !deliverable && job.status === "DONE" && owing > 0 && <p className="mt-4 rounded-2xl p-4 text-sm" style={card}>Your {prof.deliverableLabel?.toLowerCase() ?? "files"} will be available here once the balance is paid.</p>}

        {job.updates.length > 0 && (
          <section className="mt-4 rounded-2xl p-6" style={card} aria-label="Updates">
            <p className="text-sm font-bold">Updates</p>
            <ul className="mt-3 space-y-4 text-sm">
              {job.updates.map((u) => (
                <li key={u.id}>
                  <p className="text-xs" style={{ opacity: 0.7 }}>{fmt(u.at)}{u.stage ? ` · ${stageLabel(job.niche, u.stage)}` : ""}</p>
                  {u.message && <p className="mt-0.5">{u.message}</p>}
                  {u.imageUrl && safeHttpsUrl(u.imageUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.imageUrl} alt="" className="mt-2 w-full rounded-xl object-cover" style={{ maxHeight: 260 }} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {chat && <a href={chat} target="_blank" rel="noopener noreferrer" className="mt-6 block rounded-full py-3 text-center text-sm font-semibold no-underline" style={{ border: `1px solid ${palette.ink}33` }}>Message {store.name} on WhatsApp</a>}
      </main>
    </div>
  );
}
