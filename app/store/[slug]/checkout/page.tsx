import { prisma } from "@/lib/prisma";
import { isHeenzyTemplate } from "@/lib/template-themes";
import { CheckoutClient } from "./checkout-client";
import { HeenzyCheckoutClient } from "./heenzy-checkout-client";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  const heenzy = isHeenzyTemplate(store?.template?.name);

  return heenzy ? <HeenzyCheckoutClient slug={slug} /> : <CheckoutClient slug={slug} />;
}
