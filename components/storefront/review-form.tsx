"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { createReview } from "@/lib/actions/reviews";

export type ReviewableItem = { productId: string | null; serviceId: string | null; name: string };

export function ReviewForm({ storeSlug, items }: { storeSlug: string; items: ReviewableItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [index, setIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  if (items.length === 0) return null;
  const item = items[Math.min(index, items.length - 1)];

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/reviews/upload", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Upload failed");
      setImages((prev) => [...prev, body.url]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (!rating) {
      toast.error("Please choose a star rating.");
      return;
    }
    startTransition(async () => {
      const result = await createReview(storeSlug, {
        productId: item.productId,
        serviceId: item.serviceId,
        rating,
        comment,
        images,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Thanks for your review!");
      setRating(0);
      setComment("");
      setImages([]);
      setIndex(0);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Write a review</h3>
      {items.length > 1 && (
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
        >
          {items.map((it, i) => (
            <option key={`${it.productId}-${it.serviceId}`} value={i}>{it.name}</option>
          ))}
        </select>
      )}
      {items.length === 1 && <p className="text-sm text-muted-foreground">{item.name}</p>}
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
          >
            <Star className="h-6 w-6" fill={n <= rating ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      <textarea
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        rows={4}
        maxLength={2000}
        placeholder="Tell others about your experience (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {images.map((url, i) => (
          <div key={url} className="relative h-16 w-16 overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {images.length < 5 && (
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground">
            {uploading ? <span className="text-[10px]">…</span> : <Plus className="h-5 w-5" />}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadPhoto(f);
              }}
            />
          </label>
        )}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={pending || uploading}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit review"}
      </button>
    </div>
  );
}
