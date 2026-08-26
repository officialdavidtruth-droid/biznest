// Route: /store/[slug]/admin/reviews
import { prisma } from "@/lib/prisma";

export default async function ReviewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

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
          <span className="text-sm text-muted-foreground">{"★".repeat(Math.round(avg))}{"☆".repeat(5 - Math.round(avg))} {avg.toFixed(1)} avg · {reviews.length} reviews</span>
        )}
      </div>

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{r.author.name ?? r.author.email}</p>
              <span className="text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.product?.name ?? r.service?.name ?? "General"} · {new Date(r.createdAt).toLocaleDateString()}
            </p>
            {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
            {r.response && (
              <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Your response</p>
                <p className="mt-1">{r.response.content}</p>
              </div>
            )}
          </div>
        ))}
        {reviews.length === 0 && (
          <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">No reviews yet.</div>
        )}
      </div>
    </div>
  );
}
