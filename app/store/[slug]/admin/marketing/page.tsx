import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function MarketingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const activeCoupons = await prisma.coupon.count({ where: { storeId: store.id, isActive: true } });
  const social = (store.socialLinks as Record<string, string> | null) ?? {};
  const socialCount = Object.values(social).filter(Boolean).length;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Marketing</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={`/store/${slug}/admin/coupons`} className="rounded-lg border bg-background p-5 transition-colors hover:border-primary">
          <p className="font-medium">Discount coupons</p>
          <p className="mt-1 text-sm text-muted-foreground">{activeCoupons} active right now.</p>
          <p className="mt-3 text-xs font-medium text-primary">Manage coupons →</p>
        </Link>
        <Link href={`/store/${slug}/admin/settings`} className="rounded-lg border bg-background p-5 transition-colors hover:border-primary">
          <p className="font-medium">Social links</p>
          <p className="mt-1 text-sm text-muted-foreground">{socialCount} connected — shown on your storefront footer.</p>
          <p className="mt-3 text-xs font-medium text-primary">Edit in settings →</p>
        </Link>
      </div>

      <div className="mt-6 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Email campaigns and abandoned-cart recovery are on the roadmap — coupons and
        social sharing are live today.
      </div>
    </div>
  );
}
