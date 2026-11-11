import { notFound } from "next/navigation";
import { getTemplateDefinition } from "@/lib/template-registry";
import { resolveStorePalette } from "@/lib/store-palette";
import { feeConfigFor } from "@/lib/payments/customer-fee";
import { CartClient } from "@/app/store/[slug]/cart/cart-client";
import { CheckoutClient } from "@/app/store/[slug]/checkout/checkout-client";
import { PayView } from "@/components/storefront/pay-view";
import { DemoCartProvider } from "@/lib/cart-context";
import { SKIN_VIEW_ITEMS } from "./demo";
import { ProductDetail } from "@/components/storefront/product-detail";
import { CatalogExperience } from "@/components/storefront/catalog-experience";
import { catalogDesign, catalogStoreInfo } from "@/lib/storefront/catalog-props";
import { resolveStoreTheme } from "@/lib/template-themes";
import { nicheSamplePhoto } from "@/lib/niche-imagery";

export const dynamic = "force-dynamic";

/** /template-preview/<template>/cart | checkout | pay: the shared transaction pages wearing that template's skin, with demo data. */
export default async function TemplateTransactionPreview({ params }: { params: Promise<{ name: string; view: string }> }) {
  const { name, view } = await params;
  const t = getTemplateDefinition(decodeURIComponent(name));
  if (!t || !["cart", "checkout", "pay", "product", "shop"].includes(view)) notFound();
  const palette = resolveStorePalette({ name: "Demo Store", template: { name: t.name, category: t.category } });
  const theme = resolveStoreTheme(t.category, "Demo Store", null, null, t.name);
  const photo = (i: number) => nicheSamplePhoto(t.category, i) ?? null;
  const names = ["Signature Collection", "Premium Selection", "Featured Pick", "Editor's Choice", "Everyday Essential", "Limited Edition", "Best Seller", "New Arrival"];
  if (view === "product") {
    return (
      <main style={{ minHeight: "100vh", background: theme.bg, color: theme.ink, fontFamily: theme.font, padding: "3rem 1.25rem 4rem" }}>
        <ProductDetail
          skin={palette.skin} storeSlug="preview" productId="demo" name="Signature Collection" price={98000} compareAtPrice={120000} currency="NGN"
          images={[photo(0), photo(1), photo(2)].filter(Boolean) as string[]} description="A carefully made piece with a clean finish, ready to ship within two days."
          categoryName="Featured" type="PHYSICAL" rentalUnit={null} inStock stock={12}
          related={names.slice(1, 5).map((n, i) => ({ id: `r${i}`, name: n, price: 32000 + i * 9000, currency: "NGN", image: photo(i + 3) }))}
          accent={theme.accent} ink={theme.ink} radius={theme.radius || "10px"} bg={theme.bg}
        />
      </main>
    );
  }
  if (view === "shop") {
    const info = { name: "Demo Store", logoUrl: null, contactEmail: null, contactPhone: null, bannerUrl: null, sectionOverrides: null, business: { description: null, category: t.category, businessSubcategory: null, sellsProducts: true, offersServices: false, email: null, phone: null } };
    return (
      <CatalogExperience
        skin={palette.skin} store={catalogStoreInfo(info, "preview")} design={catalogDesign(info, theme)}
        items={names.map((n, i) => ({ id: `s${i}`, kind: "product" as const, name: n, price: 18000 + i * 7500, currency: "NGN", image: photo(i), categoryName: i % 2 ? "New Arrivals" : "Featured", hasVariants: false }))}
      />
    );
  }
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
