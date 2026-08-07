import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { seedSampleListings, backfillListingImages } from "@/lib/actions/store";
import { getCategoryDashboard } from "@/lib/constants/category-dashboard";

export default async function StoreDashboardHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) notFound();

  // The category chosen at onboarding drives this page — every category
  // gets its own tagline and set of quick actions, not one generic view.
  const categoryDashboard = getCategoryDashboard(store.business.category);
  const CategoryIcon = categoryDashboard.icon;

  const [orderCount, productCount, serviceCount, pendingOrders, productsWithoutPhotos, servicesWithoutPhotos] = await Promise.all([
    prisma.order.count({ where: { storeId: store.id } }),
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.service.count({ where: { storeId: store.id } }),
    prisma.order.count({ where: { storeId: store.id, status: "PENDING_PAYMENT" } }),
    prisma.product.count({ where: { storeId: store.id, images: { isEmpty: true } } }),
    prisma.service.count({ where: { storeId: store.id, images: { isEmpty: true } } }),
  ]);

  const cards = [
    { label: "Total orders", value: orderCount },
    { label: "Pending orders", value: pendingOrders },
    { label: "Products", value: productCount },
    { label: "Services", value: serviceCount },
  ];

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
              href={`/store/${slug}/admin${qa.href}`}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-primary/50"
            >
              {qa.label}
            </Link>
          ))}
        </div>
      </div>

      <Link
        href={`/store/${slug}/admin/customize`}
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
