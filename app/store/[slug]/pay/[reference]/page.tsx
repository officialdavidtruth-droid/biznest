// Route: /store/[slug]/pay/[reference]
// Where a customer lands to pay an invoice, quote deposit, booking or PMS deposit by bank transfer:
// the vendor's account details, the proof-of-payment upload and the vendor's WhatsApp / call line.
// Reachable by whoever holds the (random) payment reference, so guests with an invoice link can pay.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorePalette } from "@/lib/store-palette";
import { formatMoney } from "@/lib/utils/format-money";
import { manualPayInfoFromStore, manualPayReady } from "@/lib/payments/manual-transfer";
import { MANUAL_PURPOSE_LABEL, isManualPurpose } from "@/lib/payments/manual-flow";
import { confirmationPath } from "@/lib/payments/confirm-destination";
import { PayView } from "@/components/storefront/pay-view";

export const dynamic = "force-dynamic";

export default async function PayTransferPage({ params }: { params: Promise<{ slug: string; reference: string }> }) {
  const { slug, reference } = await params;

  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();

  const payment = await prisma.payment.findFirst({ where: { reference, storeId: store.id, provider: "CASH" } });
  if (!payment || !isManualPurpose(payment.purpose)) notFound();

  // Already confirmed (e.g. the customer reopened this link): go straight to the confirmation page.
  if (payment.status === "SUCCESSFUL") {
    const next = confirmationPath(slug, payment);
    if (next) redirect(next);
  }

  const info = manualPayInfoFromStore(store);
  const palette = resolveStorePalette(store);
  const label = MANUAL_PURPOSE_LABEL[payment.purpose];
  const code = payment.reference.split("-")[1]?.slice(-8).toUpperCase() ?? payment.reference.slice(-8).toUpperCase();
  return (
    <PayView
      palette={palette}
      slug={slug}
      store={store}
      label={label}
      code={code}
      status={payment.status}
      reference={payment.reference}
      totalLabel={formatMoney(Number(payment.amount), payment.currency)}
      info={info}
      ready={manualPayReady(info)}
      initialProofUrl={payment.proofUrl ?? null}
    />
  );
}
