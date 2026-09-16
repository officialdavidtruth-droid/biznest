import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, PackageOpen, ShoppingBag, Sparkles } from "lucide-react";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getAccountCopy } from "@/lib/account-copy";
import { prisma } from "@/lib/prisma";
import { OrdersListContent } from "../../orders/page";
import { VelouraAccountHero } from "@/components/storefront/veloura-account-shell";
import { getHotelContent } from "@/lib/hotel-content";

export default async function AccountOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, record, hotel] = await Promise.all([
    getStoreBranding(slug),
    prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } }),
    getHotelContent(slug),
  ]);
  if (!store) notFound();
  const copy = getAccountCopy(record?.template?.name, store.businessCategory);
  const hero = hotel.rooms.find((r: any) => r.featured)?.image || hotel.rooms[0]?.image || null;

  const primary = (store.themeColors as any)?.primary || "#0b4f3c";
  const secondary = (store.themeColors as any)?.secondary || "#c99845";

  return (
    <div className="veloura-account-content bn-orders-page" style={{ ["--bn-orders-primary" as any]: primary, ["--bn-orders-secondary" as any]: secondary }}>
      <section className="bn-orders-hero">
        <div className="bn-orders-hero-copy">
          <div className="bn-orders-eyebrow"><ShoppingBag size={15} /> ORDER HISTORY</div>
          <h1>My {copy.orders.toLowerCase()}</h1>
          <p>Everything you’ve purchased from <strong>{store.name}</strong>, in one place.</p>
        </div>
        {store.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bn-orders-store-logo" src={store.logoUrl} alt={store.name} />
        ) : (
          <div className="bn-orders-store-logo bn-orders-store-logo-fallback">{store.name.charAt(0).toUpperCase()}</div>
        )}
      </section>

      <div className="bn-orders-toolbar">
        <div>
          <span className="bn-orders-toolbar-label">YOUR PURCHASES</span>
          <h2>Order history</h2>
        </div>
        <Link className="bn-orders-shop-link" href={`/store/${slug}`}>
          Continue shopping <ArrowRight size={16} />
        </Link>
      </div>

      <OrdersListContent slug={slug} />

      <div className="bn-orders-trust">
        <Sparkles size={17} />
        <span>Orders from {store.name} stay connected to your account so you can return to them whenever you need.</span>
      </div>
    </div>
  );
}
