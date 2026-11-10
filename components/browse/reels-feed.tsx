"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Heart, MessageCircle, Share2, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { loadMoreBrowse, toggleBrowseLike, toggleBrowseSave } from "@/lib/actions/browse";
import type { BrowsePostView } from "@/lib/browse-data";
import { compactCount, isOfficialSlug, postPath, storeBrowsePath } from "@/lib/browse";
import { nativeShare } from "@/lib/native";
import { playableVideoUrl } from "@/lib/browse-video";
import { storeHref } from "@/lib/utils/store-href";
import { useDoubleTapLike } from "@/components/browse/double-tap-like";
import { StoreBadges } from "@/components/browse/store-badges";
import { trackBrowse, trackDwell, trackImpression } from "@/components/browse/browse-track";

const rail = "flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]";

function Reel({ initial, muted, onMute }: { initial: BrowsePostView; muted: boolean; onMute: () => void }) {
  const [post, setPost] = useState(initial);
  const [paused, setPaused] = useState(false);
  const box = useRef<HTMLElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const dest = post.product ? storeHref(post.store.slug, `/${post.product.kind === "SERVICE" ? "service" : "product"}/${post.product.id}`) : storeHref(post.store.slug);

  // React doesn't reliably write the muted attribute; iPhones refuse to autoplay a video that isn't truly muted.
  useEffect(() => { if (vid.current) vid.current.muted = muted; }, [muted]);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let dwell: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(([e]) => {
      const v = vid.current;
      if (v) v.muted = muted;
      if (e.isIntersecting && e.intersectionRatio >= 0.6) {
        setPaused(false); void v?.play().catch(() => {}); trackImpression(initial.id);
        if (!dwell) dwell = setTimeout(() => trackDwell(initial.id, true), 3000); // watched 3 seconds: a signal for "For you"
      } else { v?.pause(); if (v) v.currentTime = 0; if (dwell) { clearTimeout(dwell); dwell = null; } }
    }, { threshold: [0, 0.6] });
    io.observe(el);
    return () => { io.disconnect(); if (dwell) clearTimeout(dwell); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  function toggle() { const v = vid.current; if (!v) return; if (v.paused) { void v.play().catch(() => {}); setPaused(false); } else { v.pause(); setPaused(true); } }
  const dt = useDoubleTapLike(() => { if (!post.liked) void like(); });
  async function like() {
    const prev = post;
    setPost({ ...post, liked: !post.liked, likeCount: Math.max(0, post.likeCount + (post.liked ? -1 : 1)) });
    const r = await toggleBrowseLike(post.id);
    if (r.success) setPost((p) => ({ ...p, liked: r.data.liked, likeCount: r.data.likeCount })); else { setPost(prev); toast.error(r.error); }
  }
  async function save() {
    const prev = post;
    setPost({ ...post, saved: !post.saved });
    const r = await toggleBrowseSave(post.id);
    if (r.success) { setPost((p) => ({ ...p, saved: r.data.saved, saveCount: r.data.saveCount })); toast.success(r.data.saved ? "Saved" : "Removed from saved"); } else { setPost(prev); toast.error(r.error); }
  }
  async function share() {
    const url = `${window.location.origin}${postPath(post.id)}`;
    try {
      if (!(await nativeShare({ title: post.store.name, text: post.caption.slice(0, 100), url }))) {
        if (navigator.share) await navigator.share({ title: post.store.name, text: post.caption.slice(0, 100), url });
        else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
      }
      trackBrowse({ kind: "SHARE", postId: post.id });
    } catch { /* cancelled */ }
  }

  return (
    <article ref={box} className="relative h-[100svh] w-full snap-start snap-always overflow-hidden bg-black" aria-label={`Video from ${post.store.name}`}>
      <video
        ref={vid} src={playableVideoUrl(post.videoUrl!)} poster={post.images[0]} muted={muted} loop playsInline preload="metadata"
        onClick={(e) => dt.tap(e, toggle)} className="h-full w-full cursor-pointer object-contain" aria-label={`Video from ${post.store.name}. Tap to ${paused ? "play" : "pause"}.`}
      />
      {dt.heart}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white">
        <div className="min-w-0 flex-1 pb-1">
          <Link href={storeBrowsePath(post.store.slug)} className="inline-flex max-w-full items-center gap-2 font-bold">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/20 text-sm ring-2 ring-[#F5B82E]">
              {post.store.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={post.store.logoUrl} alt="" className="h-full w-full object-cover" /> : post.store.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate">{post.store.name}</span>
            <StoreBadges verified={post.store.verified} mogul={post.store.mogul} official={isOfficialSlug(post.store.slug)} dark />
          </Link>
          {post.caption && <p className="mt-2 line-clamp-2 text-sm leading-snug text-white/90">{post.caption}</p>}
          {post.product && (
            <Link href={dest} onClick={() => trackBrowse({ kind: "SHOP_TAP", postId: post.id })} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-[#F5B82E] py-2.5 pl-3.5 pr-4 text-sm font-bold text-[#14301A]">
              <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{post.product.kind === "SERVICE" ? "Book" : "Shop"}: {post.product.name}</span>
            </Link>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-3 text-xs font-semibold">
          <button type="button" onClick={like} aria-pressed={post.liked} aria-label={post.liked ? "Unlike" : "Like"} className={rail}><Heart className={`h-6 w-6 ${post.liked ? "fill-rose-500 text-rose-500" : ""}`} aria-hidden /></button>
          <span className="-mt-2">{compactCount(post.likeCount)}</span>
          <Link href={postPath(post.id)} aria-label="Comments" className={rail}><MessageCircle className="h-6 w-6" aria-hidden /></Link>
          <span className="-mt-2">{compactCount(post.commentCount)}</span>
          <button type="button" onClick={save} aria-pressed={post.saved} aria-label={post.saved ? "Remove from saved" : "Save"} className={rail}><Bookmark className={`h-6 w-6 ${post.saved ? "fill-white" : ""}`} aria-hidden /></button>
          <button type="button" onClick={share} aria-label="Share" className={rail}><Share2 className="h-6 w-6" aria-hidden /></button>
          <button type="button" onClick={onMute} aria-label={muted ? "Turn sound on" : "Mute"} className={rail}>{muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}</button>
        </div>
      </div>
    </article>
  );
}

export function ReelsFeed({ initialPosts, initialCursor }: { initialPosts: BrowsePostView[]; initialCursor: string | null; signedIn: boolean }) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [muted, setMuted] = useState(true);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const more = useCallback(async () => {
    if (busy.current || !cursor) return;
    busy.current = true;
    try {
      const r = await loadMoreBrowse({ sort: "foryou", cursor, videoOnly: true });
      if (r.success) {
        setPosts((cur) => { const seen = new Set(cur.map((p) => p.id)); return [...cur, ...r.data.posts.filter((p) => !seen.has(p.id))]; });
        setCursor(r.data.nextCursor);
      }
    } finally { busy.current = false; }
  }, [cursor]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) void more(); }, { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, cursor]);

  return (
    <div className="fixed inset-0 z-40 bg-black text-white">
      <Link href="/browse" aria-label="Back to Browse" className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]"><ArrowLeft className="h-5 w-5" aria-hidden /></Link>
      <h1 className="absolute left-1/2 top-[max(1.1rem,env(safe-area-inset-top))] z-10 -translate-x-1/2 text-base font-bold drop-shadow">Reels</h1>
      {posts.length === 0 ? (
        <div className="grid h-full place-items-center px-8 text-center">
          <div><p className="text-xl font-bold">No videos yet</p><p className="mt-2 text-sm text-white/70">When shops post videos, they play here.</p><Link href="/browse" className="mt-5 inline-flex rounded-full bg-[#F5B82E] px-5 py-2.5 text-sm font-bold text-[#14301A]">Back to Browse</Link></div>
        </div>
      ) : (
        <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]">
          {posts.map((p) => <Reel key={p.id} initial={p} muted={muted} onMute={() => setMuted((m) => !m)} />)}
          <div ref={sentinel} aria-hidden className="h-px" />
        </div>
      )}
    </div>
  );
}
