// Route: /store/[slug]/orders/[orderId]/pay
// Where a customer lands after checkout when the store takes bank transfers:
// the vendor's account details, the proof-of-payment upload, and the vendor's WhatsApp.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrderForBuyer } from "@/lib/actions/order";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { resolveStorePalette } from "@/lib/store-palette";
import { formatMoney } from "@/lib/utils/format-money";
import { getOrderPayableNaira } from "@/lib/payments/order-payable";
import { manualPayInfoFromStore, manualPayReady } from "@/lib/payments/manual-transfer";
import { ManualPaymentPanel } from "@/components/storefront/manual-payment-panel";

export const dynamic = "force-dynamic";

export default async function PayOrderPage({ params }: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await params;

  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();

  const session = await getStoreCustomerSessionForStore(slug);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/store/${slug}/orders/${orderId}/pay`)}&store=${encodeURIComponent(slug)}`);
  }

  const order = await getOrderForBuyer(orderId, slug);
  if (!order) notFound();
  if (order.status !== "PENDING_PAYMENT") redirect(`/store/${slug}/orders/${orderId}/confirmation`);
  if (order.paymentProvider !== "CASH") notFound();

  const info = manualPayInfoFromStore(store);
  const palette = resolveStorePalette(store);
  const orderCode = order.id.slice(-8).toUpperCase();

  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 720 }} className="mx-auto px-6 py-14">
        <h1 style={{ fontFamily: palette.headlineFont }} className="text-3xl font-extrabold">Complete your payment</h1>
        <p className="mt-2 mb-8 text-sm" style={{ opacity: 0.7 }}>
          Order #{orderCode} · {store.name}
        </p>
        {manualPayReady(info) ? (
          <ManualPaymentPanel
            slug={slug}
            orderId={order.id}
            orderCode={orderCode}
            storeName={store.name}
            totalLabel={formatMoney(await getOrderPayableNaira(order.id, order.total), order.currency)}
            info={{
              bankName: info.bankName!,
              accountName: info.accountName!,
              accountNumber: info.accountNumber!,
              note: info.note,
              whatsapp: info.whatsapp,
            }}
            initialProofUrl={order.paymentProofUrl ?? null}
            palette={palette}
          />
        ) : (
          <p className="rounded-2xl p-6 text-sm" style={{ background: palette.card, border: `1px solid ${palette.ink}14` }}>
            {store.name} hasn&apos;t published its payment details right now. Please contact the store to complete order #{orderCode}.
          </p>
        )}
      </main>
    </div>
  );
}
