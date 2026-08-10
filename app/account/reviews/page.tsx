import { listReviewsForUser } from "@/lib/actions/account";
import { Star } from "lucide-react";

export default async function ReviewsPage() {
  const reviews = await listReviewsForUser();

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
        <Star className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">You haven't written any reviews yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => {
        const listing = r.product ?? r.service;
        return (
          <div key={r.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">{listing?.name ?? r.store.name}</div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                ))}
              </div>
            </div>
            <div className="text-xs text-slate-500">{r.store.name}</div>
            {r.comment && <p className="mt-2 text-sm text-slate-700">{r.comment}</p>}
            {r.response && (
              <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                <span className="font-medium">Business response:</span> {r.response.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
