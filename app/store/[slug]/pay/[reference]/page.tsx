// Route: /store/[slug]/pay/[reference]
// Where a customer lands to pay an invoice, quote deposit, booking or PMS deposit by bank transfer:
// the vendor's account details, the proof-of-payment upload and the vendor's WhatsApp / call line.
// Reachable by whoever holds the (random) payment reference, so guests with an invoice link can pay.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { formatMoney } from "@/lib/utils/format-money";
import { manualPayInfoFromStore, manualPayReady } from "@/lib/payments/manual-transfer";
import { MANUAL_PURPOSE_LABEL, isManualPurpose } from "@/lib/payments/manual-flow";
import { ManualPaymentPanel } from "@/components/storefront/manual-payment-panel";

export const dynamic = "force-dynamic";

export default async function PayTransferPage({ params }: { params: Promise<{ slug: string; reference: string }> }) {
  const { slug, reference } = await params;

  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();

  const payment = await prisma.payment.findFirst({ where: { reference, storeId: store.id, provider: "CASH" } });
  if (!payment || !isManualPurpose(payment.purpose)) notFound();

  const info = manualPayInfoFromStore(store);
  const palette = resolveStorePalette(store);
  const label = MANUAL_PURPOSE_LABEL[payment.purpose];
  const code = payment.reference.split("-")[1]?.slice(-8).toUpperCase() ?? payment.reference.slice(-8).toUpperCase();
  const card = { background: palette.card, border: `1px solid ${palette.ink}14` };

  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 720 }} className="mx-auto px-6 py-14">
        <h1 style={{ fontFamily: palette.headlineFont }} className="text-3xl font-extrabold">Complete your payment</h1>
        <p className="mt-2 mb-8 text-sm" style={{ opacity: 0.7 }}>
          {label} #{code} · {store.name}
        </p>

        {payment.status === "SUCCESSFUL" ? (
          <div className="rounded-2xl p-6 text-sm" style={card}>
            <p className="font-semibold">Payment confirmed. Thank you!</p>
            <p className="mt-1" style={{ opacity: 0.75 }}>{store.name} has received your payment.</p>
            <Link href={`/store/${slug}`} className="mt-4 inline-block font-semibold no-underline" style={{ color: palette.accent }}>Back to store</Link>
          </div>
        ) : payment.status !== "PENDING" ? (
          <p className="rounded-2xl p-6 text-sm" style={card}>This payment is no longer open. Please contact {store.name}.</p>
        ) : manualPayReady(info) ? (
          <ManualPaymentPanel
            slug={slug}
            reference={payment.reference}
            subject={`${label.toLowerCase()} #${code}`}
            orderCode={code}
            storeName={store.name}
            totalLabel={formatMoney(Number(payment.amount), payment.currency)}
            info={{
              bankName: info.bankName!,
              accountName: info.accountName!,
              accountNumber: info.accountNumber!,
              note: info.note,
              whatsapp: info.whatsapp,
              call: info.call,
            }}
            initialProofUrl={payment.proofUrl ?? null}
            palette={palette}
          />
        ) : (
          <p className="rounded-2xl p-6 text-sm" style={card}>
            {store.name} hasn&apos;t published its payment details right now. Please contact the store to complete this payment.
          </p>
        )}
      </main>
    </div>
  );
}
