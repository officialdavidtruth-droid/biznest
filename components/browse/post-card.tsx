"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, Flag, Heart, MessageCircle, Share2, ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { addBrowseComment, deleteMyBrowseComment, loadPostComments, reportBrowse, toggleBrowseLike } from "@/lib/actions/browse";
import type { BrowseCommentView, BrowsePostView } from "@/lib/browse-data";
import { BROWSE_COMMENT_MAX, REPORT_REASONS, REPORT_REASON_LABEL, compactCount, postPath, storeBrowsePath, timeAgo, type ReportReason } from "@/lib/browse";
import { formatMoney } from "@/lib/utils/format-money";
import { storeHref } from "@/lib/utils/store-href";

const NAME_KEY = "bn-browse-name";
const input = "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/40 focus:border-white/40";

function ReportMenu({ postId, commentId, label }: { postId: string; commentId?: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs opacity-60 hover:opacity-100" aria-label={label} aria-expanded={open}>
        <Flag className="h-3.5 w-3.5" aria-hidden /> {commentId ? "" : "Report"}
      </button>
      {open && (
        <span className="absolute right-0 top-6 z-20 flex w-44 flex-col rounded-xl border border-white/15 bg-[#0d2a0f] p-1 text-xs shadow-xl" role="menu">
          {REPORT_REASONS.map((r) => (
            <button key={r} role="menuitem" disabled={pending} className="rounded-lg px-3 py-2 text-left hover:bg-white/10"
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

function Images({ post }: { post: BrowsePostView }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  if (post.images.length === 0) return null;
  const storeUrl = storeHref(post.store.slug);
  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => { const el = e.currentTarget; setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
      >
        {post.images.map((src, i) => (
          <Link key={src + i} href={post.product ? storeHref(post.store.slug, `/product/${post.product.id}`) : storeUrl} className="relative aspect-square w-full shrink-0 snap-center bg-white/5" aria-label={`Open ${post.store.name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={i === 0 ? `${post.store.name}: ${post.caption.slice(0, 80)}` : ""} loading={i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" />
          </Link>
        ))}
      </div>
      {post.images.length > 1 && (
        <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1.5" aria-hidden>
          {post.images.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`} />)}
        </div>
      )}
    </div>
  );
}

function Comments({ post, onCount }: { post: BrowsePostView; onCount: (n: number) => void }) {
  const [comments, setComments] = useState<BrowseCommentView[] | null>(null);
  const [older, setOlder] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch { /* private mode */ }
    let live = true;
    loadPostComments(post.id).then((r) => { if (live && r.success) { setComments(r.data.comments); setOlder(r.data.nextCursor); } });
    return () => { live = false; };
  }, [post.id]);

  function submit() {
    start(async () => {
      const res = await addBrowseComment(post.id, { name, body });
      if (!res.success) { toast.error(res.error); return; }
      try { if (name.trim()) localStorage.setItem(NAME_KEY, name.trim()); } catch { /* ignore */ }
      setComments((c) => [...(c ?? []), res.data.comment]);
      onCount(res.data.commentCount);
      setBody("");
    });
  }

  return (
    <div className="border-t border-white/10 px-4 pb-4 pt-3">
      {older && (
        <button className="mb-2 text-xs opacity-70 hover:opacity-100" onClick={async () => { const r = await loadPostComments(post.id, older); if (r.success) { setComments((c) => [...r.data.comments, ...(c ?? [])]); setOlder(r.data.nextCursor); } }}>View earlier comments</button>
      )}
      {comments === null ? <p className="text-xs opacity-60">Loading…</p> : comments.length === 0 ? <p className="text-xs opacity-60">No comments yet. Be the first.</p> : (
        <ul className="space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
              <p className="min-w-0 break-words"><b className="font-semibold">{c.authorName}</b> <span className="opacity-90">{c.body}</span> <span className="text-xs opacity-50">{timeAgo(new Date(c.createdAt))}</span></p>
              {c.mine ? (
                <button className="shrink-0 text-xs opacity-50 hover:opacity-100" onClick={async () => { const r = await deleteMyBrowseComment(c.id); if (r.success) { setComments((x) => (x ?? []).filter((y) => y.id !== c.id)); onCount(Math.max(0, post.commentCount - 1)); } else toast.error(r.error); }}>Delete</button>
              ) : <ReportMenu postId={post.id} commentId={c.id} label="Report this comment" />}
            </li>
          ))}
        </ul>
      )}
      <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Your name" autoComplete="given-name" />
        <div className="flex gap-2">
          <input className={input} placeholder="Add a comment…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={BROWSE_COMMENT_MAX} aria-label="Comment" />
          <button type="submit" disabled={pending || !body.trim()} className="shrink-0 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">Post</button>
        </div>
      </form>
    </div>
  );
}

export function PostCard({ post: initial, openComments = false }: { post: BrowsePostView; openComments?: boolean }) {
  const [post, setPost] = useState(initial);
  const [showComments, setShowComments] = useState(openComments);
  const [more, setMore] = useState(false);
  const [pending, start] = useTransition();
  const storeUrl = storeHref(post.store.slug);
  const long = post.caption.length > 140 || post.caption.split("\n").length > 3;

  function like() {
    const prev = post;
    setPost({ ...post, liked: !post.liked, likeCount: Math.max(0, post.likeCount + (post.liked ? -1 : 1)) });
    start(async () => {
      const r = await toggleBrowseLike(post.id);
      if (r.success) setPost((p) => ({ ...p, liked: r.data.liked, likeCount: r.data.likeCount }));
      else { setPost(prev); toast.error(r.error); }
    });
  }

  async function share() {
    const url = `${window.location.origin}${postPath(post.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: post.store.name, text: post.caption.slice(0, 100), url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* cancelled */ }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]" aria-label={`Post by ${post.store.name}`}>
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href={storeBrowsePath(post.store.slug)} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-bold">
            {post.store.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={post.store.logoUrl} alt="" className="h-full w-full object-cover" /> : post.store.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 truncate text-sm font-semibold">{post.store.name}{post.store.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-label="Verified business" />}</span>
            <span className="block truncate text-xs opacity-60">{[post.store.category, post.store.city].filter(Boolean).join(" · ")} · {timeAgo(new Date(post.createdAt))}</span>
          </span>
        </Link>
        <Link href={storeUrl} className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 sm:inline-flex"><Store className="h-3.5 w-3.5" /> Visit store</Link>
        <ReportMenu postId={post.id} label="Report this post" />
      </header>

      <Images post={post} />

      {post.product && (
        <Link href={storeHref(post.store.slug, `/product/${post.product.id}`)} className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/10">
          <span className="flex min-w-0 items-center gap-2"><ShoppingBag className="h-4 w-4 shrink-0 opacity-70" /><span className="truncate font-medium">{post.product.name}</span></span>
          <span className="shrink-0 font-semibold">{post.product.price != null ? formatMoney(post.product.price, post.product.currency) : "View"}</span>
        </Link>
      )}

      <div className="flex items-center gap-4 px-4 pt-3">
        <button onClick={like} disabled={pending} aria-pressed={post.liked} aria-label={post.liked ? "Unlike" : "Like"} className="inline-flex items-center gap-1.5 text-sm">
          <Heart className={`h-6 w-6 transition ${post.liked ? "fill-rose-500 text-rose-500" : ""}`} />
          <span>{compactCount(post.likeCount)}</span>
        </button>
        <button onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} aria-label="Comments" className="inline-flex items-center gap-1.5 text-sm">
          <MessageCircle className="h-6 w-6" /><span>{compactCount(post.commentCount)}</span>
        </button>
        <button onClick={share} aria-label="Share" className="ml-auto inline-flex items-center gap-1.5 text-sm"><Share2 className="h-5 w-5" /></button>
      </div>

      {post.caption && (
        <div className="px-4 pb-4 pt-2 text-sm">
          <p className={`whitespace-pre-line break-words ${!more && long ? "line-clamp-3" : ""}`}><Link href={storeUrl} className="font-semibold">{post.store.name}</Link> {post.caption}</p>
          {long && <button className="mt-1 text-xs opacity-60 hover:opacity-100" onClick={() => setMore((v) => !v)}>{more ? "less" : "more"}</button>}
        </div>
      )}
      {!post.caption && <div className="pb-3" />}

      {showComments && <Comments post={post} onCount={(n) => setPost((p) => ({ ...p, commentCount: n }))} />}
    </article>
  );
}
