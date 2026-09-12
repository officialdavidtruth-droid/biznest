import { OrdersListContent } from "../../orders/page";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getAccountCopy } from "@/lib/account-copy";
import { prisma } from "@/lib/prisma";

// Nested inside the themed account shell (see ../layout.tsx), which already
// supplies the header/back-link/footer for both the signature and legacy
// shells -- so this renders only the order-list content, not the standalone
// route's own sticky header + StoreFooter (see ../../orders/page.tsx for
// that full-chrome version, used when a customer is not already inside
// the account area).
export default async function AccountOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBranding(slug);
  const record = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } });
  // Title matches whatever the sidebar called this link (Purchases,
  // Invoices, Reservations, etc.) instead of always saying "My orders" --
  // see lib/account-copy.ts.
  const copy = getAccountCopy(record?.template?.name, store?.businessCategory);
  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-slate-900">My {copy.orders.toLowerCase()}</h1>
      <OrdersListContent slug={slug} />
    </div>
  );
}
