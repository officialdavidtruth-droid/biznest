import { prisma } from "@/lib/prisma";
import { isHeenzyTemplate, isVioletTemplate, VIOLET } from "@/lib/template-themes";
import { CheckoutClient } from "./checkout-client";
import { HeenzyCheckoutClient } from "./heenzy-checkout-client";
import { VioletCheckoutClient } from "./violet-checkout-client";
import { VioletHeader, VioletFooter } from "@/components/storefront/templates/violet-chrome";
import { getStoreCategoryTree } from "@/lib/storefront-categories";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  const heenzy = isHeenzyTemplate(store?.template?.name);
  const violet = store && isVioletTemplate(store.template?.name);

  if (violet && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: VIOLET.bg, color: VIOLET.ink, fontFamily: VIOLET.font, minHeight: "100vh" }}>
        <VioletHeader store={store} slug={slug} navCategories={navCategories} />
        <VioletCheckoutClient slug={slug} />
        <VioletFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  return heenzy ? <HeenzyCheckoutClient slug={slug} /> : <CheckoutClient slug={slug} />;
}
