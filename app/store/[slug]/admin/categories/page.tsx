// Route: /store/[slug]/admin/categories
// Simple mode: a plain list (add, rename, reorder, show or hide). Advanced mode: the full category manager.
import Link from "next/link";
import { getStoreCategories, getCategoryItemCounts } from "@/lib/actions/category";
import { CategoryManager } from "@/components/dashboard/category-manager";
import { SimpleCategoryList } from "@/components/dashboard/simple-category-list";
import { prisma } from "@/lib/prisma";
import { getBusinessTerminology } from "@/lib/business-terminology";
import { getCanonicalBusinessType, isRestaurantBusiness } from "@/lib/business-identity";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { normalizeSiteMode } from "@/lib/site-mode";
import { pluralize, topLevelRows } from "@/lib/storefront/simple-categories";

export default async function CategoriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [categories, itemCounts, store, access] = await Promise.all([
    getStoreCategories(slug),
    getCategoryItemCounts(slug),
    prisma.store.findUnique({ where: { slug }, select: { siteMode: true, businessType: true, business: { select: { category: true, businessSubcategory: true, sellsProducts: true, offersServices: true } } } }),
    assertStorePermission(slug, "products"),
  ]);
  const terminology = getBusinessTerminology(store?.business.category);

  if (normalizeSiteMode(store?.siteMode) === "ADVANCED") {
    return (
      <div className="bn-admin-page">
        <CategoryManager slug={slug} initialCategories={categories} itemCounts={itemCounts} terminology={terminology} businessCategory={store?.business.category} />
      </div>
    );
  }

  const canonical = getCanonicalBusinessType({ businessCategory: store?.business?.category, storeBusinessType: store?.businessType });
  const simpleTerms = getBusinessTerminology(canonical, store?.business?.businessSubcategory);
  const heading = isRestaurantBusiness(canonical) ? "Menu Categories" : pluralize(simpleTerms.category);
  const sells = store?.business?.sellsProducts ?? true;
  const offers = store?.business?.offersServices ?? false;
  const canEdit = access.success && access.role !== "STAFF";

  return (
    <div className="bn-admin-page max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Group what you offer so customers can find things easily. Switch one off to hide it from your website. Use the arrows to change the order.
        </p>
      </div>

      <SimpleCategoryList
        slug={slug}
        initialRows={topLevelRows(categories, itemCounts)}
        canEdit={canEdit}
        singular={simpleTerms.category}
        offersBoth={sells && offers}
        defaultType={!sells && offers ? "SERVICE" : "PRODUCT"}
      />

      <p className="text-xs text-muted-foreground">
        Need subcategories, pictures or icons? Turn on <Link href={`/${slug}/admin/website`} className="underline">Advanced options</Link> in My Website.
      </p>
    </div>
  );
}
