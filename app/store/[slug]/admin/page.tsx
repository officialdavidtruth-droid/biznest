import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AlertTriangle, Info } from "lucide-react";
import { seedSampleListings, backfillListingImages } from "@/lib/actions/store";
import { getCategoryDashboard } from "@/lib/constants/category-dashboard";
import { getDashboardInsights } from "@/lib/actions/analytics";
import { getTrustScoreBreakdown } from "@/lib/actions/trust-score";
import { TrustScoreCard } from "@/components/dashboard/trust-score-card";

export default async function StoreDashboardHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) notFound();

  // The category chosen at onboarding drives this page — every category
  // gets its own tagline and set of quick actions, not one generic view.
  const categoryDashboard = getCategoryDashboard(store.business.category);
  const CategoryIcon = categoryDashboard.icon;

  const [productCount, serviceCount, productsWithoutPhotos, servicesWithoutPhotos, insights, trustScore] = await Promise.all([
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.service.count({ where: { storeId: store.id } }),
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

  const stats: { label: string; value: string }[] = [
    { label: "Revenue", value: `₦${insights.revenueToday.toLocaleString()}` },
    { label: "Orders", value: insights.ordersToday.toLocaleString() },
    { label: "Visitors", value: insights.visitorsToday.toLocaleString() },
    { label: "Conversion", value: insights.conversionRate !== null ? `${insights.conversionRate}%` : "—" },
    { label: "Best product", value: insights.bestProduct?.name ?? "—" },
    { label: "Returning customers", value: insights.returningCustomerRate !== null ? `${insights.returningCustomerRate}%` : "—" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CategoryIcon className="h-3.5 w-3.5" />
            {categoryDashboard.tagline}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categoryDashboard.quickActions.map((qa) => (
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

      <p className="mb-3 text-sm font-medium">Your business today</p>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 truncate text-2xl font-semibold" title={s.value}>{s.value}</p>
          </div>
        ))}
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
