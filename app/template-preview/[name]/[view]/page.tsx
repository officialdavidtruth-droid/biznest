import { notFound } from "next/navigation";
import { getTemplateDefinition } from "@/lib/template-registry";
import { resolveStorePalette } from "@/lib/store-palette";
import { feeConfigFor } from "@/lib/payments/customer-fee";
import { CartClient } from "@/app/store/[slug]/cart/cart-client";
import { CheckoutClient } from "@/app/store/[slug]/checkout/checkout-client";
import { PayView } from "@/components/storefront/pay-view";
import { DemoCartProvider } from "@/lib/cart-context";
import { SKIN_VIEW_ITEMS } from "./demo";

export const dynamic = "force-dynamic";

/** /template-preview/<template>/cart | checkout | pay: the shared transaction pages wearing that template's skin, with demo data. */
export default async function TemplateTransactionPreview({ params }: { params: Promise<{ name: string; view: string }> }) {
  const { name, view } = await params;
  const t = getTemplateDefinition(decodeURIComponent(name));
  if (!t || !["cart", "checkout", "pay"].includes(view)) notFound();
  const palette = resolveStorePalette({ name: "Demo Store", template: { name: t.name, category: t.category } });
  return (
    <>
      <DemoCartProvider storeSlug="preview" items={SKIN_VIEW_ITEMS}>
      {view === "cart" && <CartClient slug="preview" storeName="Demo Store" palette={palette} />}
      {view === "checkout" && <CheckoutClient slug="preview" storeName="Demo Store" palette={palette} feeConfig={feeConfigFor("PAYSTACK")} />}
      {view === "pay" && (
        <PayView
          palette={palette} slug="preview" store={{ name: "Demo Store" }} label="Invoice" code="A7K29QXM" status="PENDING" reference="demo-A7K29QXM"
          totalLabel="₦184,000" ready initialProofUrl={null}
          info={{ bankName: "Demo Bank", accountName: "Demo Store Ltd", accountNumber: "0123456789", note: "Use the order code as the narration.", whatsapp: "2348000000000", call: "2348000000000" }}
        />
      )}
      </DemoCartProvider>
    </>
  );
}
