// Route: /store/[slug]/admin/
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AlertTriangle, Info } from "lucide-react";
import { seedSampleListings, backfillListingImages } from "@/lib/actions/store";
import { getAdaptiveDashboardConfig } from "@/lib/adaptive-dashboard";
import { getDashboardInsights } from "@/lib/actions/analytics";
import { getTrustScoreBreakdown } from "@/lib/actions/trust-score";
import { TrustScoreCard } from "@/components/dashboard/trust-score-card";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function StoreDashboardHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) notFound();

  const terminology = getBusinessTerminology(store.business.category);

  const adaptive = getAdaptiveDashboardConfig(
    store.business.category,
    store.business.businessSubcategory,
    { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices },
  );

  const [productCount, serviceCount, bookingCount, productsWithoutPhotos, servicesWithoutPhotos, insights, trustScore] = await Promise.all([
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.service.count({ where: { storeId: store.id } }),
    prisma.booking.count({ where: { storeId: store.id } }),
    prisma.product.count({ where: { storeId: store.id, images: { isEmpty: true } } }),
    prisma.service.count({ where: { storeId: store.id, images: { isEmpty: true } } }),
    getDashboardInsights(store.id, slug),
    getTrustScoreBreakdown(store.business.id),
  ]);

  const isEmpty = productCount === 0 && serviceCount === 0;
  const missingPhotoCount = productsWithoutPhotos + servicesWithoutPhotos;

  // <form action> requires a handler returning void | Promise<void> — thin
  // wrappers here rather than binding the actions directly, since they
  // return ActionResult for programmatic callers elsewhere.
  async function seedForStore() {
    "use server";
    await seedSampleListings(slug);
  }
  async function backfillPhotos() {
    "use server";
    await backfillListingImages(slug);
  }

  const statValues: Record<string, string> = {
    revenue: `₦${insights.revenueToday.toLocaleString()}`,
    orders: insights.ordersToday.toLocaleString(),
    visitors: insights.visitorsToday.toLocaleString(),
    conversion: insights.conversionRate !== null ? `${insights.conversionRate}%` : "—",
    bestProduct: insights.bestProduct?.name ?? "—",
    returning: insights.returningCustomerRate !== null ? `${insights.returningCustomerRate}%` : "—",
    products: productCount.toLocaleString(),
    services: serviceCount.toLocaleString(),
    bookings: bookingCount.toLocaleString(),
    customers: "—",
  };

  const stats = adaptive.kpis.map((kpi) => ({ label: kpi.label, value: statValues[kpi.source] ?? "—" }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{adaptive.label}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{adaptive.primaryEntity}</span>
            <span className="text-muted-foreground/50">·</span> {adaptive.tagline}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {adaptive.quickActions.map((qa) => (
            <Link
              key={qa.href}
              href={`/${slug}/admin${qa.href}`}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-primary/50"
            >
              {qa.label}
            </Link>
          ))}
        </div>
      </div>

      <Link
        href={`/${slug}/admin/customize`}
        className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-4 transition hover:border-primary/50"
      >
        <div>
          <p className="text-sm font-medium">Customize your website</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Change your template, colors, and page layout with a live preview — like a website editor.
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Customize
        </span>
      </Link>

      {isEmpty && (
        <form action={seedForStore} className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium">Your storefront has no listings yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your live store page will look empty to visitors until you add something. Add
              two starter listings matching your template to see a fully designed storefront
              right away — edit or delete them anytime.
            </p>
          </div>
          <button className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Add starter listings
          </button>
        </form>
      )}

      {!isEmpty && missingPhotoCount > 0 && (
        <form action={backfillPhotos} className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium">{missingPhotoCount} listing{missingPhotoCount === 1 ? "" : "s"} missing a photo</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Auto-fill with a matching demo photo for anything that doesn't have one yet —
              only fills gaps, never replaces a photo you've already set.
            </p>
          </div>
          <button className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Add photos
          </button>
        </form>
      )}

      <p className="mb-3 text-sm font-medium">{store.business.category === "Restaurant" ? "Your restaurant today" : `Your ${terminology.catalog.toLowerCase()} & ${terminology.transaction.toLowerCase()} activity`}</p>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 truncate text-2xl font-semibold" title={s.value}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <div className="mb-3">
          <p className="text-sm font-medium">Your adaptive workspace</p>
          <p className="mt-0.5 text-xs text-muted-foreground">BizNest automatically arranged the tools for {adaptive.businessType}{adaptive.subcategory ? ` · ${adaptive.subcategory}` : ""}.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {adaptive.widgets.slice(0, 6).map((widget) => (
            <Link key={widget.id} href={widget.href ? `/${slug}/admin${widget.href}` : `/${slug}/admin`} className="rounded-lg border bg-background p-4 transition hover:border-primary/50">
              <p className="text-sm font-medium">{widget.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{widget.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {trustScore && (
        <div className="mb-8">
          <p className="mb-3 text-sm font-medium">Your BizNest Trust Score</p>
          <TrustScoreCard breakdown={trustScore} />
        </div>
      )}

      {insights.recommendations.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-medium">BizNest recommends</p>
          <div className="flex flex-col gap-2">
            {insights.recommendations.map((r) => {
              const Icon = r.severity === "warning" ? AlertTriangle : Info;
              return (
                <div
                  key={r.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 ${
                    r.severity === "warning" ? "border-amber-300/60 bg-amber-50 dark:bg-amber-950/20" : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${r.severity === "warning" ? "text-amber-600" : "text-muted-foreground"}`} />
                    <p className="text-sm">{r.message}</p>
                  </div>
                  <Link
                    href={r.actionHref}
                    className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-primary/50"
                  >
                    {r.actionLabel}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
