"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MultiImageUpload } from "@/components/forms/multi-image-upload";
import { createBrowsePost, createBrowseStory, deleteBrowsePost, deleteBrowseStory, listPostCommentsForOwner, setBrowseCommentHidden, setBrowsePostHidden } from "@/lib/actions/browse-vendor";
import { BROWSE_CAPTION_MAX, BROWSE_MAX_IMAGES, STORY_BG_COLORS, STORY_TEXT_MAX, postPath, storeBrowsePath, timeAgo } from "@/lib/browse";
import type { BrowseCommentView, VendorPostView, VendorStoryView } from "@/lib/browse-data";

type Result = { success: boolean; error?: string };
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60";
const ghost = "rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60";

const STATUS: Record<string, string> = { PUBLISHED: "Live", HIDDEN: "Hidden" };

function PostRow({ slug, p, run, pending }: { slug: string; p: VendorPostView; run: (fn: () => Promise<Result>, ok?: string) => void; pending: boolean }) {
  const [comments, setComments] = useState<BrowseCommentView[] | null>(null);
  const [show, setShow] = useState(false);
  const underReview = p.status === "HIDDEN" && p.hiddenReason && p.hiddenReason !== "OWNER";
  async function toggleComments() {
    const next = !show; setShow(next);
    if (next && comments === null) { const r = await listPostCommentsForOwner(slug, p.id); if (r.success) setComments(r.data.comments); }
  }
  return (
    <li className="rounded-xl border p-4">
      <div className="flex gap-3">
        {p.images[0] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.images[0]} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 whitespace-pre-line text-sm">{p.caption || <span className="text-muted-foreground">(photo only)</span>}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {timeAgo(new Date(p.createdAt))} · {p.likeCount} like{p.likeCount === 1 ? "" : "s"} · {p.commentCount} comment{p.commentCount === 1 ? "" : "s"}{p.productName ? ` · ${p.productName}` : ""} ·{" "}
            <span className={p.status === "PUBLISHED" ? "text-emerald-700" : "text-amber-700"}>{underReview ? "Held for review" : STATUS[p.status] ?? p.status}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className={ghost} onClick={toggleComments}>{show ? "Hide comments" : "Comments"}</button>
            {p.status === "PUBLISHED" && <a className={ghost} href={postPath(p.id)} target="_blank" rel="noreferrer">View</a>}
            {!underReview && <button className={ghost} disabled={pending} onClick={() => run(() => setBrowsePostHidden(slug, p.id, p.status === "PUBLISHED"), p.status === "PUBLISHED" ? "Hidden from the feed." : "Back in the feed.")}>{p.status === "PUBLISHED" ? "Hide" : "Show again"}</button>}
            <button className={ghost} disabled={pending} onClick={() => { if (confirm("Delete this post and its likes and comments?")) run(() => deleteBrowsePost(slug, p.id), "Deleted."); }}>Delete</button>
          </div>
          {underReview && <p className="mt-2 text-xs text-amber-800">Several people reported this post, so it&apos;s hidden until BizNest staff review it.</p>}
        </div>
      </div>
      {show && (
        <ul className="mt-3 space-y-2 border-t pt-3 text-sm">
          {comments === null ? <li className="text-xs text-muted-foreground">Loading…</li> : comments.length === 0 ? <li className="text-xs text-muted-foreground">No comments.</li> : comments.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3">
              <p className={`min-w-0 break-words ${c.hidden ? "opacity-50 line-through" : ""}`}><b>{c.authorName}</b> {c.body} <span className="text-xs text-muted-foreground">{timeAgo(new Date(c.createdAt))}</span></p>
              <button className="shrink-0 text-xs underline" disabled={pending} onClick={async () => { const r = await setBrowseCommentHidden(slug, c.id, !c.hidden); if (r.success) setComments((x) => (x ?? []).map((y) => y.id === c.id ? { ...y, hidden: !c.hidden } : y)); }}>{c.hidden ? "Show" : "Hide"}</button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function BrowseWorkspace({ slug, data, stories, products, dailyLimit }: { slug: string; data: { posts: VendorPostView[]; postedToday: number; totals: { likes: number; comments: number } }; stories: VendorStoryView[]; products: Array<{ id: string; name: string }>; dailyLimit: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [productId, setProductId] = useState("");
  const [storyMode, setStoryMode] = useState<"photo" | "text">("photo");
  const [storyImage, setStoryImage] = useState<string[]>([]);
  const [storyText, setStoryText] = useState("");
  const [storyBg, setStoryBg] = useState<string>(STORY_BG_COLORS[0]);
  const [storyProduct, setStoryProduct] = useState("");

  const run = (fn: () => Promise<Result>, ok?: string, after?: () => void) => {
    setError(""); setNote("");
    start(async () => {
      const r = await fn();
      if (!r.success) { setError(r.error ?? "Something went wrong."); return; }
      if (ok) setNote(ok);
      after?.();
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border p-4"><p className="text-2xl font-bold">{data.totals.likes}</p><p className="text-xs text-muted-foreground">Likes</p></div>
        <div className="rounded-xl border p-4"><p className="text-2xl font-bold">{data.totals.comments}</p><p className="text-xs text-muted-foreground">Comments</p></div>
        <div className="rounded-xl border p-4"><p className="text-2xl font-bold">{data.postedToday}/{dailyLimit}</p><p className="text-xs text-muted-foreground">Posted in 24h</p></div>
      </div>

      <section className="rounded-xl border p-5">
        <h2 className="text-sm font-semibold">New post</h2>
        <div className="mt-3 space-y-3">
          <textarea className={input} rows={3} maxLength={BROWSE_CAPTION_MAX} placeholder="What's new today? A fresh batch, a promo, a finished job…" value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Caption" />
          <MultiImageUpload value={images} onChange={setImages} max={BROWSE_MAX_IMAGES} label={`Photos (up to ${BROWSE_MAX_IMAGES})`} />
          <label className="block text-xs">Tag a product (optional)
            <select className={`${input} mt-1`} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">None</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <button className={btn} disabled={pending || (!caption.trim() && images.length === 0)} onClick={() => run(() => createBrowsePost(slug, { caption, images, productId: productId || null }), "Posted to Browse.", () => { setCaption(""); setImages([]); setProductId(""); })}>{pending ? "Posting…" : "Post to Browse"}</button>
            <span className="text-xs text-muted-foreground">{caption.length}/{BROWSE_CAPTION_MAX}</span>
          </div>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          {note && <p role="status" className="text-xs text-emerald-700">{note}</p>}
          <p className="text-xs text-muted-foreground">Tip: you can also share a product in one tap from Products, using the ⋮ menu.</p>
        </div>
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Stories <span className="font-normal text-muted-foreground">(disappear after 24 hours)</span></h2>
        <div className="mt-3 space-y-3">
          <div className="flex gap-2" role="tablist" aria-label="Story type">
            {(["photo", "text"] as const).map((m) => <button key={m} role="tab" aria-selected={storyMode === m} className={storyMode === m ? btn : ghost} onClick={() => setStoryMode(m)}>{m === "photo" ? "Photo" : "Text card"}</button>)}
          </div>
          {storyMode === "photo" ? (
            <MultiImageUpload value={storyImage} onChange={setStoryImage} max={1} label="Story photo" />
          ) : (
            <div className="rounded-xl p-6 text-center text-white" style={{ background: storyBg }}>
              <textarea className="w-full resize-none bg-transparent text-center text-xl font-bold placeholder:text-white/60 focus:outline-none" rows={3} maxLength={STORY_TEXT_MAX} placeholder="Today only: free delivery!" value={storyText} onChange={(e) => setStoryText(e.target.value)} aria-label="Story text" />
              <div className="mt-3 flex justify-center gap-2">{STORY_BG_COLORS.map((c) => <button key={c} aria-label={`Background ${c}`} aria-pressed={storyBg === c} onClick={() => setStoryBg(c)} className={`h-6 w-6 rounded-full border-2 ${storyBg === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />)}</div>
            </div>
          )}
          {storyMode === "photo" && <input className={input} maxLength={STORY_TEXT_MAX} placeholder="Caption (optional)" value={storyText} onChange={(e) => setStoryText(e.target.value)} aria-label="Story caption" />}
          <label className="block text-xs">Link a product (optional)
            <select className={`${input} mt-1`} value={storyProduct} onChange={(e) => setStoryProduct(e.target.value)}>
              <option value="">None</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button className={btn} disabled={pending || (storyMode === "photo" ? storyImage.length === 0 : !storyText.trim())}
            onClick={() => run(() => createBrowseStory(slug, { imageUrl: storyMode === "photo" ? storyImage[0] : null, text: storyText, bgColor: storyBg, productId: storyProduct || null }), "Story added.", () => { setStoryImage([]); setStoryText(""); setStoryProduct(""); })}>{pending ? "Adding…" : "Add to your story"}</button>
        </div>
        {stories.length > 0 && (
          <ul className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {stories.map((st) => (
              <li key={st.id} className="w-24 shrink-0 text-center text-xs">
                <div className={`relative h-32 w-24 overflow-hidden rounded-lg border ${st.live ? "" : "opacity-50"}`} style={st.kind === "TEXT" ? { background: st.bgColor ?? "#0f3d1e" } : undefined}>
                  {st.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={st.imageUrl} alt="" className="h-full w-full object-cover" /> : <p className="grid h-full place-items-center p-2 text-[11px] font-bold text-white">{st.text}</p>}
                </div>
                <p className="mt-1 text-muted-foreground">{st.live ? `${st.viewCount} view${st.viewCount === 1 ? "" : "s"}` : "Expired"}</p>
                <button className="underline" disabled={pending} onClick={() => run(() => deleteBrowseStory(slug, st.id), "Story deleted.")}>Delete</button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Your public page: <a className="underline" href={storeBrowsePath(slug)} target="_blank" rel="noreferrer">{storeBrowsePath(slug)}</a></p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Your posts</h2>
        {data.posts.length === 0 ? <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Nothing posted yet.</p> : (
          <ul className="space-y-3">{data.posts.map((p) => <PostRow key={p.id} slug={slug} p={p} run={run} pending={pending} />)}</ul>
        )}
      </section>
    </div>
  );
}
