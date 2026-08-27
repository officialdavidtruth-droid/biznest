import { OrdersListContent } from "../../orders/page";

// Nested inside the themed account shell (see ../layout.tsx), which already
// supplies the header/back-link/footer for both the signature and legacy
// shells -- so this renders only the order-list content, not the standalone
// route's own sticky header + StoreFooter (see ../../orders/page.tsx for
// that full-chrome version, used when a customer is not already inside
// the account area).
export default async function AccountOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-slate-900">My orders</h1>
      <OrdersListContent slug={slug} />
    </div>
  );
}
