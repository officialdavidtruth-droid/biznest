"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { nativeShare } from "@/lib/native";
import { Bookmark, Flag, Heart, MessageCircle, Pin, Play, Share2, Star, ShoppingBag, Store, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { addBrowseComment, deleteMyBrowseComment, loadPostComments, loadPostReviewSummary, pinBrowseComment, reportBrowse, toggleBrowseLike, toggleBrowseSave } from "@/lib/actions/browse";
import type { BrowseCommentView, BrowsePostView, PostReviews } from "@/lib/browse-data";
import { BROWSE_COMMENT_MAX, INTERACT_NEEDS_ACCOUNT, isOfficialSlug, isTrustedSeller, REPORT_REASONS, REPORT_REASON_LABEL, splitHashtags, compactCount, postPath, storeBrowsePath, timeAgo, type ReportReason, type Sticker } from "@/lib/browse";
import { useDoubleTapLike } from "@/components/browse/double-tap-like";
import { StoreBadges } from "@/components/browse/store-badges";
import { formatMoney } from "@/lib/utils/format-money";
import { trackBrowse, trackDwell, trackImpression } from "@/components/browse/browse-track";
import { storeHref } from "@/lib/utils/store-href";
import { playableVideoUrl } from "@/lib/browse-video";

const display = "font-[family-name:var(--font-browse-display)]";
const input = "w-full rounded-xl border border-[#14301A]/15 bg-white px-3 py-2 text-sm text-[#14301A] outline-none placeholder:text-[#14301A]/40 focus:border-[#14301A]/50 focus-visible:ring-2 focus-visible:ring-[#F5B82E]";
const iconBtn = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium hover:bg-[#14301A]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14301A] disabled:opacity-60";

function ReportMenu({ postId, commentId, label }: { postId: string; commentId?: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-full p-1.5 text-xs text-[#14301A]/55 hover:bg-[#14301A]/5 hover:text-[#14301A]" aria-label={label} aria-expanded={open}>
        <Flag className="h-3.5 w-3.5" aria-hidden /> {commentId ? "" : "Report"}
      </button>
      {open && (
        <span className="absolute right-0 top-8 z-20 flex w-44 flex-col rounded-2xl border border-[#14301A]/10 bg-white p-1 text-xs text-[#14301A] shadow-xl" role="menu">
          {REPORT_REASONS.map((r) => (
            <button key={r} role="menuitem" disabled={pending} className="rounded-xl px-3 py-2 text-left hover:bg-[#14301A]/5"
              onClick={() => start(async () => {
                const res = await reportBrowse({ postId, commentId, reason: r as ReportReason });
                setOpen(false);
                if (res.success) toast.success("Thanks. We'll take a look."); else toast.error(res.error);
              })}>{REPORT_REASON_LABEL[r]}</button>
          ))}
        </span>
      )}
    </span>
  );
}

/** Plays (muted) while it is mostly on screen and pauses when scrolled away. Tap to pause or play; the speaker button turns sound on. */
function StickerLayer({ stickers }: { stickers: Sticker[] }) {
  if (stickers.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ containerType: "inline-size" }} aria-hidden>
      {stickers.map((st, i) => <span key={i} className={`absolute -translate-x-1/2 -translate-y-1/2 ${st.k === "text" ? "whitespace-nowrap rounded-[0.4em] bg-black/55 px-[0.4em] font-bold text-white" : ""}`} style={{ left: `${st.x}%`, top: `${st.y}%`, fontSize: `${st.s * (st.k === "text" ? 5.5 : 9.4)}cqw`, lineHeight: st.k === "text" ? 1.5 : 1 }}>{st.e}</span>)}
    </div>
  );
}

function CaptionText({ text }: { text: string }) {
  return <>{splitHashtags(text).map((p, i) => (p.tag ? <Link key={i} href={`/browse/tag/${encodeURIComponent(p.text.slice(1).toLowerCase())}`} className="font-medium text-[#1d6b3a] hover:underline">{p.text}</Link> : <span key={i}>{p.text}</span>))}</>;
}

function PostMeta({ post }: { post: BrowsePostView }) {
  if (!post.location && !post.aiGenerated && post.tags.length === 0) return null;
  return (
    <div className="space-y-1 px-3.5 pb-3 text-xs text-[#14301A]/70">
      {(post.location || post.aiGenerated) && (
        <p>{post.location && <span>📍 {post.location}</span>}{post.location && post.aiGenerated ? " · " : ""}{post.aiGenerated && <span>AI-generated</span>}</p>
      )}
      {post.tags.length > 0 && (
        <p>With{" "}
          {post.tags.map((t, i) => (
            <span key={`${t.kind}${t.name}${i}`}>
              {i > 0 && ", "}
              {t.slug ? <Link href={storeBrowsePath(t.slug)} className="font-semibold text-[#14301A] hover:underline">{t.name}</Link> : <span className="font-semibold text-[#14301A]">{t.name}</span>}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function FeedVideo({ post, onDoubleLike }: { post: BrowsePostView; onDoubleLike?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const dt = useDoubleTapLike(onDoubleLike ?? (() => {}));
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false); // stickers are already in the poster; show them live once it plays
  const byUserRef = useRef(false);
  const mutedRef = useRef(true);
  mutedRef.current = muted;
  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.6) { el.muted = mutedRef.current; if (!byUserRef.current) el.play().catch(() => {}); }
      else el.pause();
    }, { threshold: [0, 0.6] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  function toggle() {
    const el = ref.current; if (!el) return;
    if (el.paused) { byUserRef.current = false; el.play().catch(() => {}); }
    else { byUserRef.current = true; el.pause(); }
  }
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black">
      <video
        ref={ref} src={playableVideoUrl(post.videoUrl!)} poster={post.images[0]} muted={muted} loop playsInline preload="metadata"
        onPlay={() => { setPaused(false); setStarted(true); }} onPause={() => setPaused(true)} onClick={(e) => (onDoubleLike ? dt.tap(e, toggle) : toggle())}
        className="h-full w-full cursor-pointer object-contain" aria-label={`Video from ${post.store.name}. Tap to ${paused ? "play" : "pause"}.`}
      />
      {started && <StickerLayer stickers={post.stickers} />}
      {dt.heart}
      {paused && (
        <button type="button" onClick={toggle} aria-label="Play video" className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <Play className="h-6 w-6 fill-white" aria-hidden />
        </button>
      )}
      <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Turn sound on" : "Mute"} className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

function Images({ post, wrapClass, onDoubleLike }: { post: BrowsePostView; wrapClass?: string; onDoubleLike?: () => void }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const dt = useDoubleTapLike(onDoubleLike ?? (() => {}));
  if (post.images.length === 0 && !post.videoUrl) return null;
  const storeUrl = storeHref(post.store.slug);
  const dest = post.product ? storeHref(post.store.slug, `/${post.product.kind === "SERVICE" ? "service" : "product"}/${post.product.id}`) : storeUrl;
  return (
    <div className={wrapClass ?? "relative px-2.5 lg:mx-auto lg:w-[min(100%,max(340px,calc((100svh-250px)*0.8+1.25rem)))]"}>
      {post.videoUrl ? (
        <FeedVideo post={post} onDoubleLike={onDoubleLike} />
      ) : (
      <div
        ref={ref}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => { const el = e.currentTarget; setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
      >
        {post.images.map((src, i) => (
          <Link key={src + i} href={dest} className="relative aspect-[4/5] w-full shrink-0 snap-center bg-[#14301A]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]" aria-label={`Open ${post.store.name}`} onClick={onDoubleLike ? (e) => dt.tap(e, () => router.push(dest)) : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={i === 0 ? `${post.store.name}: ${post.caption.slice(0, 80)}` : ""} loading={i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" />
            {i === 0 && <StickerLayer stickers={post.stickers} />}
          </Link>
        ))}
      </div>
      )}
      {!post.videoUrl && dt.heart}
      {post.product && (
        <Link href={dest} onClick={() => trackBrowse({ kind: "SHOP_TAP", postId: post.id })} className={`absolute ${post.videoUrl ? "top-3" : "bottom-4"} left-6 flex max-w-[78%] items-center gap-2 rounded-full bg-[#F5B82E] py-2 pl-3 pr-4 text-[#14301A] shadow-lg ring-1 ring-black/10 hover:bg-[#ffc94d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}>
          <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate text-sm font-semibold">{post.product.name}</span>
          {post.product.price != null && <span className={`${display} shrink-0 text-sm font-extrabold`}>{formatMoney(post.product.price, post.product.currency)}</span>}
        </Link>
      )}
      {!post.videoUrl && post.images.length > 1 && (
        <div className="pointer-events-none absolute right-6 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white" aria-hidden>{idx + 1}/{post.images.length}</div>
      )}
    </div>
  );
}

/** Guests get a toast with a sign-up shortcut that returns them to this page; other errors show as-is. */
function needAccountToast(error: string) {
  if (error !== INTERACT_NEEDS_ACCOUNT) { toast.error(error); return; }
  const back = encodeURIComponent(window.location.pathname + window.location.search);
  toast(error, { description: "It's free and only takes a minute.", action: { label: "Create account", onClick: () => window.location.assign(`/join?callbackUrl=${back}`) } });
}

/**
 * The comments view. On a laptop it opens as a window: the post on the left and the
 * conversation on the right. On a phone it rises as a sheet from the bottom, with the
 * comment box pinned above the keyboard.
 */
const QUICK_REPLIES = ["Yes, it's available. Tap Shop now to order.", "Thank you! 🙏", "Please check our store for the full price list."];

function PostModal({ post, onClose, onCount, onLike, onSave, onShare, liking }: {
  post: BrowsePostView; onClose: () => void; onCount: (n: number) => void; onLike: () => void; onSave: () => void; onShare: () => void; liking: boolean;
}) {
  const [isOwner, setIsOwner] = useState(false);
  const [reviews, setReviews] = useState<PostReviews | null>(null);
  const [comments, setComments] = useState<BrowseCommentView[] | null>(null);
  const [older, setOlder] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const storeUrl = storeHref(post.store.slug);
  const hasMedia = post.images.length > 0 || !!post.videoUrl;

  useEffect(() => {
    let live = true;
    loadPostComments(post.id).then((r) => { if (live && r.success) { setComments(r.data.comments); setOlder(r.data.nextCursor); setIsOwner(r.data.isOwner); } });
    loadPostReviewSummary(post.id).then((r) => { if (live && r.success) setReviews(r.data); });
    return () => { live = false; };
  }, [post.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  function submit() {
    start(async () => {
      const res = await addBrowseComment(post.id, { body });
      if (!res.success) { needAccountToast(res.error); return; }
      setComments((c) => [...(c ?? []), res.data.comment]);
      onCount(res.data.commentCount);
      setBody("");
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
    });
  }

  async function togglePin(c: BrowseCommentView) {
    const r = await pinBrowseComment(c.id, !c.pinned);
    if (!r.success) { toast.error(r.error); return; }
    setComments((list) => {
      const rest = (list ?? []).map((x) => ({ ...x, pinned: x.id === c.id ? !c.pinned : false }));
      if (c.pinned) return rest;
      return [...rest.filter((x) => x.id === c.id), ...rest.filter((x) => x.id !== c.id)];
    });
  }

  const avatar = (name: string, url: string | null, size: string) => (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-[#14301A]/10 text-xs font-bold`}>
      {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
    </span>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label={`Post by ${post.store.name}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 hidden h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 lg:flex">
        <X className="h-5 w-5" aria-hidden />
      </button>
      <div className={`flex h-[88svh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#FBF6E9] text-[#14301A] lg:h-[min(86svh,760px)] lg:rounded-3xl ${hasMedia ? "lg:max-w-[1000px] lg:flex-row" : "lg:max-w-[460px]"}`}>
        {hasMedia && (
          <div className="hidden min-w-0 flex-1 items-center justify-center bg-black lg:flex">
            <div className="w-full"><Images post={post} onDoubleLike={() => { if (!post.liked) onLike(); }} wrapClass="relative mx-auto w-[min(100%,calc(min(86svh,760px)*0.8))] px-0" /></div>
          </div>
        )}
        <div className="flex min-h-0 w-full flex-col lg:w-[380px] lg:shrink-0 lg:border-l lg:border-[#14301A]/10">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[#14301A]/20 lg:hidden" aria-hidden />
          <header className="flex items-center gap-2.5 border-b border-[#14301A]/10 px-4 py-3">
            <Link href={storeBrowsePath(post.store.slug)} className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="rounded-full ring-2 ring-[#F5B82E] ring-offset-1 ring-offset-[#FBF6E9]">{avatar(post.store.name, post.store.logoUrl, "h-9 w-9")}</span>
              <span className={`${display} flex min-w-0 items-center gap-1 truncate text-sm font-bold`}>{post.store.name}<StoreBadges verified={post.store.verified} mogul={post.store.mogul} official={isOfficialSlug(post.store.slug)} /></span>
            </Link>
            <Link href={storeUrl} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#14301A] px-3 py-1.5 text-xs font-semibold text-[#FBF6E9] hover:bg-[#0c1f11]"><Store className="h-3.5 w-3.5" aria-hidden /> Visit store</Link>
            <button type="button" onClick={onClose} aria-label="Close comments" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-[#14301A]/5 lg:hidden"><X className="h-5 w-5" aria-hidden /></button>
          </header>

          <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
            {post.caption && (
              <div className="flex gap-3">
                {avatar(post.store.name, post.store.logoUrl, "h-8 w-8")}
                <div className="min-w-0 text-sm leading-snug">
                  <p className="whitespace-pre-line break-words"><Link href={storeUrl} className={`${display} font-bold hover:underline`}>{post.store.name}</Link> <CaptionText text={post.caption} /></p>
                  <p className="mt-1 text-xs text-[#14301A]/50">{timeAgo(new Date(post.createdAt))}</p>
                </div>
              </div>
            )}
            {reviews && (
              <div className="rounded-2xl bg-[#14301A]/[0.04] p-3">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <Star className="h-4 w-4 fill-[#F5B82E] text-[#F5B82E]" aria-hidden />
                  <b>{reviews.avg.toFixed(1)}</b>
                  <span className="text-[#14301A]/70">from {reviews.count} {reviews.count === 1 ? "review" : "reviews"}</span>
                  {isTrustedSeller(reviews) && <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-xs font-semibold text-emerald-800">Trusted seller</span>}
                </p>
                {reviews.photos.length > 0 && (
                  <div className="mt-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label="Photos from buyers">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {reviews.photos.map((u, i) => <img key={i} src={u} alt="Photo from a buyer" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover" />)}
                  </div>
                )}
                {reviews.latest[0] && <p className="mt-2 text-sm leading-snug text-[#14301A]/85">&ldquo;{reviews.latest[0].comment}&rdquo; <span className="text-xs text-[#14301A]/55">{reviews.latest[0].author}</span></p>}
              </div>
            )}
            {older && (
              <button className="text-xs font-medium text-[#14301A]/70 hover:text-[#14301A]" onClick={async () => { const r = await loadPostComments(post.id, older); if (r.success) { setComments((c) => [...r.data.comments, ...(c ?? [])]); setOlder(r.data.nextCursor); } }}>View earlier comments</button>
            )}
            {comments === null ? <p className="text-sm text-[#14301A]/60">Loading comments…</p> : comments.length === 0 ? (
              <div className="py-10 text-center"><p className="font-semibold">No comments yet</p><p className="mt-1 text-sm text-[#14301A]/60">Start the conversation.</p></div>
            ) : comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F5B82E]/30 text-xs font-bold">{c.authorName.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1 text-sm leading-snug">
                  {c.pinned && <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#14301A]/55"><Pin className="h-3 w-3" aria-hidden />Pinned by {post.store.name}</p>}
                  <p className="break-words"><b className="font-semibold">{c.authorName}</b>{c.byStore && <span className="ml-1.5 rounded-full bg-[#14301A] px-1.5 py-px align-middle text-[10px] font-bold text-[#FBF6E9]">Store</span>} <span className="opacity-90">{c.body}</span></p>
                  <p className="mt-1 flex items-center gap-3 text-xs text-[#14301A]/50">
                    <span>{timeAgo(new Date(c.createdAt))}</span>
                    {isOwner && <button className="hover:text-[#14301A]" onClick={() => void togglePin(c)}>{c.pinned ? "Unpin" : "Pin"}</button>}
                    {c.mine ? (
                      <button className="hover:text-[#14301A]" onClick={async () => { const r = await deleteMyBrowseComment(c.id); if (r.success) { setComments((x) => (x ?? []).filter((y) => y.id !== c.id)); onCount(Math.max(0, post.commentCount - 1)); } else toast.error(r.error); }}>Delete</button>
                    ) : <ReportMenu postId={post.id} commentId={c.id} label="Report this comment" />}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[#14301A]/10">
            <div className="flex items-center gap-1 px-2.5 pt-1.5">
              <button onClick={onLike} disabled={liking} aria-pressed={post.liked} aria-label={post.liked ? "Unlike" : "Like"} className={iconBtn}>
                <Heart className={`h-6 w-6 transition ${post.liked ? "fill-rose-500 text-rose-500" : ""}`} aria-hidden />
              </button>
              <span className={`${iconBtn} pointer-events-none`} aria-hidden><MessageCircle className="h-6 w-6" /></span>
              <button onClick={onShare} aria-label="Share" className={`${iconBtn} ml-auto`}><Share2 className="h-5 w-5" aria-hidden /></button>
              <button onClick={onSave} aria-pressed={post.saved} aria-label={post.saved ? "Remove from saved" : "Save"} className={iconBtn}><Bookmark className={`h-5 w-5 ${post.saved ? "fill-[#14301A]" : ""}`} aria-hidden /></button>
            </div>
            <p className="px-4 text-sm font-semibold">{post.likeCount === 1 ? "1 like" : `${compactCount(post.likeCount)} likes`}</p>
            <p className="px-4 pb-2 text-xs text-[#14301A]/50">{timeAgo(new Date(post.createdAt))}</p>
            {isOwner && (
              <div className="flex gap-1.5 overflow-x-auto border-t border-[#14301A]/10 px-3 py-2 [scrollbar-width:none]" aria-label="Quick replies">
                {QUICK_REPLIES.map((q) => <button key={q} type="button" onClick={() => setBody(q)} className="shrink-0 rounded-full bg-[#14301A]/8 px-3 py-1.5 text-xs font-medium hover:bg-[#14301A]/15">{q}</button>)}
              </div>
            )}
            <form className="flex items-center gap-2 border-t border-[#14301A]/10 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" onSubmit={(e) => { e.preventDefault(); if (body.trim()) submit(); }}>
              <input className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base text-[#14301A] outline-none placeholder:text-[#14301A]/45 sm:text-sm" placeholder={isOwner ? `Reply as ${post.store.name}…` : "Add a comment…"} value={body} onChange={(e) => setBody(e.target.value)} maxLength={BROWSE_COMMENT_MAX} aria-label="Comment" />
              <button type="submit" disabled={pending || !body.trim()} className="shrink-0 px-2 text-sm font-semibold text-[#1d6b3a] disabled:text-[#14301A]/30">Post</button>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PostCard({ post: initial }: { post: BrowsePostView }) {
  const [post, setPost] = useState(initial);
  const [showComments, setShowComments] = useState(false);
  const [more, setMore] = useState(false);
  const [pending, start] = useTransition();
  const storeUrl = storeHref(post.store.slug);
  const dest = post.product ? storeHref(post.store.slug, `/${post.product.kind === "SERVICE" ? "service" : "product"}/${post.product.id}`) : storeUrl;
  const cardRef = useRef<HTMLElement>(null);
  // An impression is counted when at least half the post has been on screen.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let dwell: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible) {
        trackImpression(initial.id);
        // Still on screen after 2.5 seconds counts as real interest (it feeds "For you").
        if (!dwell) dwell = setTimeout(() => trackDwell(initial.id, !!initial.videoUrl), 2500);
      } else if (dwell) { clearTimeout(dwell); dwell = null; }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); if (dwell) clearTimeout(dwell); };
  }, [initial.id, initial.videoUrl]);
  const long = post.caption.length > 140 || post.caption.split("\n").length > 3;

  function like() {
    const prev = post;
    setPost({ ...post, liked: !post.liked, likeCount: Math.max(0, post.likeCount + (post.liked ? -1 : 1)) });
    start(async () => {
      const r = await toggleBrowseLike(post.id);
      if (r.success) setPost((p) => ({ ...p, liked: r.data.liked, likeCount: r.data.likeCount }));
      else { setPost(prev); needAccountToast(r.error); }
    });
  }

  function save() {
    const prev = post;
    setPost({ ...post, saved: !post.saved, saveCount: Math.max(0, post.saveCount + (post.saved ? -1 : 1)) });
    start(async () => {
      const r = await toggleBrowseSave(post.id);
      if (r.success) { setPost((p) => ({ ...p, saved: r.data.saved, saveCount: r.data.saveCount })); toast.success(r.data.saved ? "Saved. Find it under Saved." : "Removed from saved."); }
      else { setPost(prev); needAccountToast(r.error); }
    });
  }

  async function share() {
    const url = `${window.location.origin}${postPath(post.id)}`;
    try {
      if (await nativeShare({ title: post.store.name, text: post.caption.slice(0, 100), url })) { /* shared from the phone share sheet */ }
      else if (navigator.share) await navigator.share({ title: post.store.name, text: post.caption.slice(0, 100), url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
      trackBrowse({ kind: "SHARE", postId: post.id });
    } catch { /* cancelled */ }
  }

  return (
    <article ref={cardRef} className="overflow-hidden rounded-3xl bg-[#FBF6E9] text-[#14301A] shadow-[0_14px_32px_-20px_rgba(0,0,0,.65)]" aria-label={`Post by ${post.store.name}`}>
      <header className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3">
        <Link href={storeBrowsePath(post.store.slug)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14301A]">
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#14301A]/10 text-sm font-bold ring-2 ring-[#F5B82E] ring-offset-1 ring-offset-[#FBF6E9]">
            {post.store.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={post.store.logoUrl} alt="" className="h-full w-full object-cover" /> : post.store.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className={`${display} flex items-center gap-1 truncate text-sm font-bold leading-tight`}>{post.store.name}<StoreBadges verified={post.store.verified} mogul={post.store.mogul} official={isOfficialSlug(post.store.slug)} /></span>
            <span className="block truncate text-[11px] text-[#14301A]/60">{[post.store.category, post.store.city].filter(Boolean).join(", ")}{(post.store.category || post.store.city) ? ", " : ""}{timeAgo(new Date(post.createdAt))}</span>
          </span>
        </Link>
        <Link href={storeUrl} className="hidden shrink-0 items-center gap-1.5 rounded-full bg-[#14301A] px-3 py-1.5 text-xs font-semibold text-[#FBF6E9] hover:bg-[#0c1f11] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14301A] sm:inline-flex"><Store className="h-3.5 w-3.5" aria-hidden /> Visit store</Link>
        <ReportMenu postId={post.id} label="Report this post" />
      </header>

      <Images post={post} onDoubleLike={() => { if (!post.liked) like(); }} />

      <div className="flex items-center gap-0.5 px-2 pt-1.5">
        <button onClick={like} disabled={pending} aria-pressed={post.liked} aria-label={post.liked ? "Unlike" : "Like"} className={iconBtn}>
          <Heart className={`h-6 w-6 transition ${post.liked ? "fill-rose-500 text-rose-500" : ""}`} aria-hidden />
          <span>{compactCount(post.likeCount)}</span>
        </button>
        <button onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} aria-label="Comments" className={iconBtn}>
          <MessageCircle className="h-6 w-6" aria-hidden /><span>{compactCount(post.commentCount)}</span>
        </button>
        <button onClick={share} aria-label="Share" className={`${iconBtn} ml-auto`}><Share2 className="h-5 w-5" aria-hidden /></button>
        <button onClick={save} disabled={pending} aria-pressed={post.saved} aria-label={post.saved ? "Remove from saved" : "Save"} className={iconBtn}><Bookmark className={`h-5 w-5 transition ${post.saved ? "fill-[#14301A]" : ""}`} aria-hidden /></button>
      </div>

      {post.caption && (
        <div className="px-3.5 pb-3 pt-0.5 text-sm leading-snug">
          <p className={`whitespace-pre-line break-words ${!more && long ? "line-clamp-3" : ""}`}><Link href={storeUrl} className={`${display} font-bold hover:underline`}>{post.store.name}</Link> <CaptionText text={post.caption} /></p>
          {long && <button className="mt-1 text-xs font-medium text-[#14301A]/60 hover:text-[#14301A]" onClick={() => setMore((v) => !v)}>{more ? "Show less" : "Read more"}</button>}
        </div>
      )}
      {!post.caption && <div className="pb-2" />}
      {post.product && (
        <div className="px-3.5 pb-2.5">
          <Link href={dest} onClick={() => trackBrowse({ kind: "SHOP_TAP", postId: post.id })} className="flex items-center justify-between gap-3 rounded-2xl bg-[#14301A] px-4 py-3 text-[#FBF6E9] hover:bg-[#0c1f11] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]">
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{post.product.name}</span>{post.product.price != null && <span className="text-xs text-[#F5B82E]">{formatMoney(post.product.price, post.product.currency)}</span>}</span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F5B82E] px-3.5 py-1.5 text-sm font-bold text-[#14301A]"><ShoppingBag className="h-4 w-4" aria-hidden />{post.product.kind === "SERVICE" ? "Book now" : "Shop now"}</span>
          </Link>
        </div>
      )}
      <PostMeta post={post} />

      {showComments && <PostModal post={post} onClose={() => setShowComments(false)} onCount={(n) => setPost((p) => ({ ...p, commentCount: n }))} onLike={like} onSave={save} onShare={share} liking={pending} />}
    </article>
  );
}
