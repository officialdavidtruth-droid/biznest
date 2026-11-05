import { notFound } from "next/navigation";
import { Star, MessageSquareText } from "lucide-react";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { listStoreReviews } from "@/lib/actions/account";
import { listReviewableItems } from "@/lib/actions/reviews";
import { ReviewForm } from "@/components/storefront/review-form";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraAccountHero } from "@/components/storefront/veloura-account-shell";
import { formatDate } from "@/lib/i18n/locale";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, reviews, hotel, reviewable] = await Promise.all([
    getStoreBranding(slug),
    listStoreReviews(slug),
    getHotelContent(slug),
    listReviewableItems(slug),
  ]);
  if (!store) notFound();
  const hero = hotel.rooms.find((r: any) => r.featured)?.image || hotel.rooms[0]?.image || null;

  return (
    <div className="veloura-account-content">
      <VelouraAccountHero
        title="My Reviews"
        subtitle={`Your reviews and feedback for ${store.name}.`}
        image={hero}
      />
      {reviewable.length > 0 && (
        <section className="veloura-panel">
          <ReviewForm storeSlug={slug} items={reviewable} />
        </section>
      )}
      <section className="veloura-panel veloura-reviews-panel">
        <div className="veloura-panel-head">
          <div>
            <h2>Your reviews</h2>
            <p>Keep track of the feedback you have shared with {store.name}.</p>
          </div>
          <span>{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</span>
        </div>

        {reviews.length ? (
          <div className="veloura-review-list">
            {reviews.map((review: any) => {
              const subject = review.product?.name ?? review.service?.name ?? "Your purchase";
              return (
                <article className="veloura-review-item" key={review.id}>
                  <div className="veloura-review-item-top">
                    <div className="veloura-review-rating" aria-label={`${review.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, i) => <Star key={i} fill={i < review.rating ? "currentColor" : "none"} />)}
                    </div>
                    <time>{formatDate(new Date(review.createdAt), { day: "2-digit", month: "short", year: "numeric" })}</time>
                  </div>
                  <h3>{subject}</h3>
                  {review.comment && <p className="veloura-review-comment">{review.comment}</p>}
                  {review.images?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {review.images.map((url: string) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="Review photo" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                        </a>
                      ))}
                    </div>
                  )}
                  {review.response && (
                    <div className="veloura-review-response">
                      <MessageSquareText size={16} />
                      <div><strong>{store.name} responded</strong><p>{review.response.content}</p></div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="veloura-empty veloura-review-empty">
            <Star />
            <strong>You haven't reviewed anything here yet.</strong>
            <span>After your stay, you'll be able to share your experience with {store.name}.</span>
          </div>
        )}
      </section>
    </div>
  );
}
