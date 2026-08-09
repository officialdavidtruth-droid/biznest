import { prisma } from "@/lib/prisma";
import { isHeenzyTemplate, isVioletTemplate, VIOLET } from "@/lib/template-themes";
import { CartClient } from "./cart-client";
import { HeenzyCartClient } from "./heenzy-cart-client";
import { VioletCartClient } from "./violet-cart-client";
import { VioletHeader, VioletFooter } from "@/components/storefront/templates/violet-chrome";
import { getStoreCategoryTree } from "@/lib/storefront-categories";

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
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
        <VioletCartClient slug={slug} />
        <VioletFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  return heenzy ? <HeenzyCartClient slug={slug} /> : <CartClient slug={slug} />;
}
