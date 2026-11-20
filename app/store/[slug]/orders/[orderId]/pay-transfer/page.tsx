// Route: /store/[slug]/orders/[orderId]/pay-transfer
// Where a customer lands after choosing "Bank transfer" at checkout: the store's own account number, the exact
// amount to send, and a live check that moves them on as soon as the transfer is received.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrderForBuyer } from "@/lib/actions/order";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { resolveStorePalette } from "@/lib/store-palette";
import { TransferPayPanel } from "@/components/storefront/transfer-pay-panel";

export const dynamic = "force-dynamic";

export default async function PayTransferPage({ params }: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await params;

  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();

  const session = await getStoreCustomerSessionForStore(slug);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/store/${slug}/orders/${orderId}/pay-transfer`)}&store=${encodeURIComponent(slug)}`);
  }

  const order = await getOrderForBuyer(orderId, slug);
  if (!order) notFound();
  if (order.status !== "PENDING_PAYMENT") redirect(`/store/${slug}/orders/${orderId}/confirmation`);

  const intent = await prisma.storeTransferIntent.findUnique({ where: { orderId } });
  if (!intent || intent.status !== "OPEN") notFound();
  const account = await prisma.storeVirtualAccount.findUnique({ where: { id: intent.virtualAccountId } });
  if (!account) notFound();

  const palette = resolveStorePalette(store);
  const orderCode = order.id.slice(-8).toUpperCase();

  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: 560 }} className="mx-auto px-5 py-10 sm:py-14">
        <h1 style={{ fontFamily: palette.headlineFont }} className="text-2xl font-extrabold sm:text-3xl">Pay by bank transfer</h1>
        <p className="mb-6 mt-2 text-sm" style={{ opacity: 0.7 }}>Order #{orderCode} · {store.name}</p>
        <TransferPayPanel
          slug={slug}
          orderId={order.id}
          orderCode={orderCode}
          amount={Number(intent.amount)}
          currency={order.currency}
          bankName={account.bankName}
          accountNumber={account.accountNumber}
          accountName={account.accountName}
          expiresAt={intent.expiresAt.toISOString()}
          palette={palette}
        />
      </main>
    </div>
  );
}
