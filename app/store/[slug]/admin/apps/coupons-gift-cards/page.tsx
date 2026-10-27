import { notFound, redirect } from "next/navigation";
import { Ticket } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";
import { CouponsSection } from "@/components/dashboard/coupons-section";
import { GiftCardsSection } from "@/components/dashboard/gift-cards-section";

export default async function CouponsGiftCardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/store/${slug}/admin/apps/coupons-gift-cards`);
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "coupons-gift-cards");
  if (!entitlement.allowed || !entitlement.installed) {
    return <PluginInstallGate slug={slug} title="Coupons & Gift Cards" message={entitlement.allowed ? undefined : entitlement.reason} icon={Ticket} />;
  }

  return (
    <div className="space-y-10">
      <section id="coupons"><CouponsSection params={Promise.resolve({ slug })} /></section>
      <section id="gift-cards"><GiftCardsSection params={Promise.resolve({ slug })} /></section>
    </div>
  );
}
