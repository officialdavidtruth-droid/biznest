// Route: /store/[slug]/admin/reviews
import { starFill, starEmpty } from "@/lib/utils/stars";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/i18n/locale";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { ReviewResponseForm } from "@/components/dashboard/review-response-form";

export default async function ReviewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await assertStorePermission(slug, "reviews");
  if (!access.success) return <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">{access.error}</div>;
  const store = access.store;

  const reviews = await prisma.review.findMany({
    where: { storeId: store.id },
    include: { author: true, product: true, service: true, response: true },
    orderBy: { createdAt: "desc" },
  });

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reviews</h1>
        {reviews.length > 0 && (
          <span className="text-sm text-muted-foreground">{starFill(Math.round(avg))}{starEmpty(Math.round(avg))} {avg.toFixed(1)} avg · {reviews.length} reviews</span>
        )}
      </div>

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{r.author.name ?? r.author.email}</p>
              <span className="text-sm">{starFill(r.rating)}{starEmpty(r.rating)}</span>
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
            {r.response && (
              <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Your response</p>
                <p className="mt-1">{r.response.content}</p>
              </div>
            )}
            <ReviewResponseForm storeSlug={slug} reviewId={r.id} existing={r.response?.content} />
          </div>
        ))}
        {reviews.length === 0 && (
          <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">No reviews yet.</div>
        )}
      </div>
    </div>
  );
}
