import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DemoStoreSetupForm } from "@/components/dashboard/demo-store-forms";
import { DEMO_STORE_EMAIL, DEMO_STORE_SLUG } from "@/lib/demo-store";

export const dynamic = "force-dynamic";

export default async function DemoStorePage() {
  const store = await prisma.store.findUnique({ where: { slug: DEMO_STORE_SLUG }, select: { marketingOnly: true, businessType: true } });
  const isSetUp = Boolean(store && !store.marketingOnly);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">BizNest demo store</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A real store on the main BizNest for running demos. It belongs to the official BizNest account, signs in like any other store, and is hidden from search and the marketplace.
          Switch its niche from Settings inside its dashboard.
        </p>
      </div>
      {isSetUp && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border bg-background p-4 text-sm">
          <span>Niche: <b>{store?.businessType}</b></span>
          <Link className="underline" href={`/${DEMO_STORE_SLUG}`} target="_blank">Open storefront</Link>
          <Link className="underline" href={`/login?callbackUrl=/store/${DEMO_STORE_SLUG}/admin`} target="_blank">Open dashboard login</Link>
        </div>
      )}
      <DemoStoreSetupForm isSetUp={isSetUp} email={DEMO_STORE_EMAIL} />
    </div>
  );
}
