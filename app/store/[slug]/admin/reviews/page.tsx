// Route: /store/[slug]/admin/reviews
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { starFill, starEmpty } from "@/lib/utils/stars";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/i18n/locale";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { ReviewResponseForm } from "@/components/dashboard/review-response-form";
import { ReviewReportForm } from "@/components/dashboard/review-report-form";
import { REVIEW_REPORT_STATUS_CONFIG } from "@/lib/constants/review-report";

const PAGE_SIZE = 20;

type Filters = { rating: number | null; item: string; status: "all" | "unreplied" | "replied" };

// Stars are text glyphs, so screen readers would read them as "black star"
// repeated. Expose the rating as a labelled image and hide the glyphs.
function Stars({ value, label }: { value: number; label?: string }) {
  return (
    <span role="img" aria-label={label ?? `${value} out of 5 stars`}>
      <span aria-hidden="true">{starFill(value)}{starEmpty(value)}</span>
    </span>
  );
}

function hrefFor(slug: string, f: Filters, page: number) {
  const q = new URLSearchParams();
  if (f.rating) q.set("rating", String(f.rating));
  if (f.item) q.set("item", f.item);
  if (f.status !== "all") q.set("status", f.status);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return `/store/${slug}/admin/reviews${s ? `?${s}` : ""}`;
}

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; rating?: string; item?: string; status?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const access = await assertStorePermission(slug, "reviews");
  if (!access.success) return <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">{access.error}</div>;
  const store = access.store;

  // --- filters (all validated; the storeId clause below scopes every query) ---
  const ratingNum = Number.parseInt(sp.rating ?? "", 10);
  const itemRaw = sp.item ?? "";
  const itemKind = itemRaw.startsWith("p:") ? "product" : itemRaw.startsWith("s:") ? "service" : null;
  const itemId = itemKind ? itemRaw.slice(2, 202) : "";
  const filters: Filters = {
    rating: ratingNum >= 1 && ratingNum <= 5 ? ratingNum : null,
    item: itemKind && itemId ? itemRaw.slice(0, 202) : "",
    status: sp.status === "unreplied" || sp.status === "replied" ? sp.status : "all",
  };
  const filtersActive = !!filters.rating || !!filters.item || filters.status !== "all";

  const where: Prisma.ReviewWhereInput = {
    storeId: store.id,
    ...(filters.rating ? { rating: filters.rating } : {}),
    ...(itemKind === "product" && itemId ? { productId: itemId } : {}),
    ...(itemKind === "service" && itemId ? { serviceId: itemId } : {}),
    ...(filters.status === "unreplied" ? { response: { is: null } } : {}),
    ...(filters.status === "replied" ? { response: { isNot: null } } : {}),
  };

  // Store-wide figures (header) come from the database, not from loading rows.
  const [overall, filteredTotal, unreplied, products, services] = await Promise.all([
    prisma.review.aggregate({ where: { storeId: store.id }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.count({ where }),
    prisma.review.count({ where: { storeId: store.id, response: { is: null } } }),
    prisma.product.findMany({ where: { storeId: store.id, reviews: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 }),
    prisma.service.findMany({ where: { storeId: store.id, reviews: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 }),
  ]);
  const total = overall._count._all;
  const avg = overall._avg.rating ?? 0;

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const requested = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(requested) ? Math.min(Math.max(1, requested), totalPages) : 1;

  const reviews = await prisma.review.findMany({
    where,
    select: {
      id: true,
      rating: true,
      comment: true,
      images: true,
      videos: true,
      createdAt: true,
      author: { select: { name: true } },
      product: { select: { name: true } },
      service: { select: { name: true } },
      response: { select: { content: true } },
      report: { select: { status: true } },
    },
    // id as a tie-breaker keeps page boundaries stable when timestamps match.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const baseHref = `/store/${slug}/admin/reviews`;
  const rangeStart = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredTotal);
  const selectClass = "rounded-md border bg-background px-2 py-1.5 text-sm text-foreground";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Reviews</h1>
        {total > 0 && (
          <div className="text-right text-sm text-muted-foreground">
            <Stars value={Math.round(avg)} label={`${avg.toFixed(1)} out of 5 stars on average`} /> {avg.toFixed(1)} avg · {total} {total === 1 ? "review" : "reviews"}
            {unreplied > 0 && (
              <>
                {" · "}
                <Link href={`${baseHref}?status=unreplied`} className="font-medium text-primary hover:underline">
                  {unreplied} awaiting reply
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {total > 0 && (
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-background p-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Rating
            <select name="rating" defaultValue={filters.rating ? String(filters.rating) : ""} className={selectClass}>
              <option value="">All ratings</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? "star" : "stars"}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Item
            <select name="item" defaultValue={filters.item} className={selectClass}>
              <option value="">All items</option>
              {products.length > 0 && (
                <optgroup label="Products">
                  {products.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}
                </optgroup>
              )}
              {services.length > 0 && (
                <optgroup label="Services">
                  {services.map((s) => <option key={s.id} value={`s:${s.id}`}>{s.name}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Replies
            <select name="status" defaultValue={filters.status} className={selectClass}>
              <option value="all">All</option>
              <option value="unreplied">Awaiting reply</option>
              <option value="replied">Replied</option>
            </select>
          </label>
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Apply</button>
          {filtersActive && <Link href={baseHref} className="py-1.5 text-sm text-muted-foreground hover:text-foreground">Clear filters</Link>}
        </form>
      )}

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{r.author.name?.trim() || "Customer"}</p>
              <span className="text-sm"><Stars value={r.rating} /></span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.product?.name ?? r.service?.name ?? "General"} · {formatDate(new Date(r.createdAt))}
            </p>
            {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
            {r.images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.images.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Review photo" className="h-16 w-16 rounded-md border object-cover" />
                  </a>
                ))}
              </div>
            )}
            {r.videos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.videos.map((url) => (
                  <video key={url} src={url} controls preload="metadata" className="h-32 max-w-full rounded-md border" />
                ))}
              </div>
            )}
            {r.response && (
              <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Your response</p>
                <p className="mt-1">{r.response.content}</p>
              </div>
            )}
            <ReviewResponseForm storeSlug={slug} reviewId={r.id} existing={r.response?.content} />
            {r.report ? (
              <p className="mt-3">
                <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${REVIEW_REPORT_STATUS_CONFIG[r.report.status].bg} ${REVIEW_REPORT_STATUS_CONFIG[r.report.status].text} ${REVIEW_REPORT_STATUS_CONFIG[r.report.status].ring}`}>
                  {REVIEW_REPORT_STATUS_CONFIG[r.report.status].label}
                </span>
              </p>
            ) : (
              <ReviewReportForm storeSlug={slug} reviewId={r.id} />
            )}
          </div>
        ))}
        {filteredTotal === 0 && (
          <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">
            {total === 0 ? "No reviews yet." : "No reviews match these filters."}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-xs text-muted-foreground" aria-label="Reviews pagination">
          <span>Showing {rangeStart} to {rangeEnd} of {filteredTotal} {filteredTotal === 1 ? "review" : "reviews"}</span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={hrefFor(slug, filters, page - 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted/40">Previous</Link>
            ) : (
              <span className="rounded-md border px-3 py-1.5 opacity-40">Previous</span>
            )}
            <span>Page {page} of {totalPages}</span>
            {page < totalPages ? (
              <Link href={hrefFor(slug, filters, page + 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted/40">Next</Link>
            ) : (
              <span className="rounded-md border px-3 py-1.5 opacity-40">Next</span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
