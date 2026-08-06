import { prisma } from "@/lib/prisma";
import { isHeenzyTemplate } from "@/lib/template-themes";
import { CartClient } from "./cart-client";
import { HeenzyCartClient } from "./heenzy-cart-client";

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  const heenzy = isHeenzyTemplate(store?.template?.name);

  return heenzy ? <HeenzyCartClient slug={slug} /> : <CartClient slug={slug} />;
}
