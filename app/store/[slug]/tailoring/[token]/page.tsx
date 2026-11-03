// Route: /store/[slug]/tailoring/[token]
// The customer's own made-to-measure status page. Reachable only with the unguessable token the tailor sends them
// (WhatsApp link), so it needs no sign-in. It shows progress, due date and what is owed, and deliberately leaves
// out measurements, notes and the customer's phone number.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { formatMoney } from "@/lib/utils/format-money";
import { whatsappLink } from "@/lib/utils/whatsapp-link";
import { NO_INDEX } from "@/lib/seo";
import { TAILORING_STAGES, TAILORING_STAGE_BLURB, isTailoringStage, isTailoringToken, parseTailoringPhotos, tailoringBalance } from "@/lib/tailoring";
import { TailoringPayButton } from "@/components/storefront/tailoring-pay-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order status", robots: NO_INDEX };

export default async function TailoringStatusPage({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { slug, token } = await params;
  const { payment: paymentFlag } = await searchParams;
  if (!isTailoringToken(token)) notFound();

  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const job = await prisma.tailoringJob.findUnique({
    where: { trackingToken: token },
    select: { storeId: true, jobNo: true, customerName: true, garmentType: true, stage: true, dueDate: true, price: true, amountPaid: true, photos: true },
  });
  if (!job || job.storeId !== store.id) notFound();

  const palette = resolveStorePalette(store);
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };
  const stage = isTailoringStage(job.stage) ? job.stage : "MEASUREMENTS";
  const stageIdx = TAILORING_STAGES.findIndex((s) => s.id === stage);
  const price = job.price == null ? null : Number(job.price);
  const paid = Number(job.amountPaid);
  const balance = tailoringBalance(price, paid);
  const money = (n: number) => formatMoney(n, store.currency);
  // Only progress photos are shown to the customer; reference photos stay with the tailor.
  const progressPhotos = parseTailoringPhotos(job.photos).filter((p) => p.kind === "progress");
  const owing = balance != null && balance > 0;

  const social = (store.socialLinks && typeof store.socialLinks === "object" ? store.socialLinks : {}) as Record<string, string | undefined>;
  const chat = whatsappLink(social.whatsapp || store.contactPhone, `Hi ${store.name}, about my ${job.garmentType} (${job.jobNo}).`);
  const due = job.dueDate ? new Date(job.dueDate).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" }) : null;

  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 560 }} className="mx-auto px-6 py-12">
        <p className="text-sm font-semibold" style={{ opacity: 0.7 }}>{store.name}</p>
        <h1 style={{ fontFamily: palette.headlineFont }} className="mt-1 text-3xl font-extrabold">Hi {job.customerName.split(" ")[0]}</h1>
        <p className="mt-2 text-sm" style={{ opacity: 0.75 }}>Your {job.garmentType} · {job.jobNo}</p>

        <section className="mt-8 rounded-2xl p-6" style={card} aria-label="Progress">
          <p className="text-lg font-bold">{TAILORING_STAGES[stageIdx].label}</p>
          <p className="mt-1 text-sm" style={{ opacity: 0.8 }}>{TAILORING_STAGE_BLURB[stage]}</p>
          <ol className="mt-5 space-y-3">
            {TAILORING_STAGES.map((s, i) => {
              const done = i < stageIdx, current = i === stageIdx;
              return (
                <li key={s.id} className="flex items-center gap-3 text-sm" aria-current={current ? "step" : undefined}>
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: done || current ? palette.accent : "transparent", color: done || current ? palette.onAccent : palette.ink, border: done || current ? "none" : `1px solid ${palette.ink}33` }}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span style={{ fontWeight: current ? 700 : 400, opacity: done || current ? 1 : 0.55 }}>{s.label}</span>
                </li>
              );
            })}
          </ol>
          {due && stage !== "DELIVERED" && <p className="mt-5 text-sm" style={{ opacity: 0.8 }}>Expected by <b>{due}</b></p>}
        </section>

        {paymentFlag === "success" && (
          <p role="status" className="mt-4 rounded-2xl p-4 text-sm font-semibold" style={card}>Payment received. Thank you!</p>
        )}
        {paymentFlag === "failed" && (
          <p role="alert" className="mt-4 rounded-2xl p-4 text-sm" style={card}>That payment didn&rsquo;t go through. You haven&rsquo;t been charged. You can try again below.</p>
        )}

        {price != null && (
          <section className="mt-4 rounded-2xl p-6 text-sm" style={card} aria-label="Payment">
            <div className="flex justify-between"><span style={{ opacity: 0.7 }}>Price</span><b>{money(price)}</b></div>
            <div className="mt-2 flex justify-between"><span style={{ opacity: 0.7 }}>Paid</span><b>{money(paid)}</b></div>
            <div className="mt-3 flex justify-between border-t pt-3" style={{ borderColor: `${palette.ink}14` }}>
              <span style={{ opacity: 0.7 }}>Balance</span>
              <b>{owing ? money(balance!) : "Paid in full"}</b>
            </div>
            {owing && (
              <TailoringPayButton slug={slug} token={token} balance={balance!} currencyLabel={store.currency} colors={{ accent: palette.accent, onAccent: palette.onAccent, ink: palette.ink }} />
            )}
          </section>
        )}

        {progressPhotos.length > 0 && (
          <section className="mt-4 rounded-2xl p-6" style={card} aria-label="Progress photos">
            <p className="text-sm font-bold">Progress photos</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {progressPhotos.map((p) => (
                <figure key={p.url} className="m-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption || "Progress photo"} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                  {p.caption && <figcaption className="mt-1 text-xs" style={{ opacity: 0.7 }}>{p.caption}</figcaption>}
                </figure>
              ))}
            </div>
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
