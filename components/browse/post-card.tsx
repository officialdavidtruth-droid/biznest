"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Flag, Heart, MessageCircle, Share2, ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { addBrowseComment, deleteMyBrowseComment, loadPostComments, reportBrowse, toggleBrowseLike } from "@/lib/actions/browse";
import type { BrowseCommentView, BrowsePostView } from "@/lib/browse-data";
import { BROWSE_COMMENT_MAX, INTERACT_NEEDS_ACCOUNT, isOfficialSlug, REPORT_REASONS, REPORT_REASON_LABEL, compactCount, postPath, storeBrowsePath, timeAgo, type ReportReason } from "@/lib/browse";
import { StoreBadges } from "@/components/browse/store-badges";
import { formatMoney } from "@/lib/utils/format-money";
import { storeHref } from "@/lib/utils/store-href";

const NAME_KEY = "bn-browse-name";
const display = "font-[family-name:var(--font-browse-display)]";
const input = "w-full rounded-xl border border-[#14301A]/15 bg-white px-3 py-2 text-sm text-[#14301A] outline-none placeholder:text-[#14301A]/40 focus:border-[#14301A]/50 focus-visible:ring-2 focus-visible:ring-[#F5B82E]";
const iconBtn = "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium hover:bg-[#14301A]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14301A] disabled:opacity-60";

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

function Images({ post }: { post: BrowsePostView }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  if (post.images.length === 0) return null;
  const storeUrl = storeHref(post.store.slug);
  const dest = post.product ? storeHref(post.store.slug, `/product/${post.product.id}`) : storeUrl;
  return (
    <div className="relative px-3">
      <div
        ref={ref}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-[22px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => { const el = e.currentTarget; setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
      >
        {post.images.map((src, i) => (
          <Link key={src + i} href={dest} className="relative aspect-[4/5] w-full shrink-0 snap-center bg-[#14301A]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]" aria-label={`Open ${post.store.name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={i === 0 ? `${post.store.name}: ${post.caption.slice(0, 80)}` : ""} loading={i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" />
          </Link>
        ))}
      </div>
      {post.product && (
        <Link href={dest} className="absolute bottom-4 left-6 flex max-w-[78%] items-center gap-2 rounded-full bg-[#F5B82E] py-2 pl-3 pr-4 text-[#14301A] shadow-lg ring-1 ring-black/10 hover:bg-[#ffc94d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate text-sm font-semibold">{post.product.name}</span>
          {post.product.price != null && <span className={`${display} shrink-0 text-sm font-extrabold`}>{formatMoney(post.product.price, post.product.currency)}</span>}
        </Link>
      )}
      {post.images.length > 1 && (
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
      if (!res.success) { needAccountToast(res.error); return; }
      try { if (name.trim()) localStorage.setItem(NAME_KEY, name.trim()); } catch { /* ignore */ }
      setComments((c) => [...(c ?? []), res.data.comment]);
      onCount(res.data.commentCount);
      setBody("");
    });
  }

  return (
    <div className="mx-3 mb-3 rounded-2xl bg-[#14301A]/[0.05] px-4 pb-4 pt-3">
      {older && (
        <button className="mb-2 text-xs text-[#14301A]/70 hover:text-[#14301A]" onClick={async () => { const r = await loadPostComments(post.id, older); if (r.success) { setComments((c) => [...r.data.comments, ...(c ?? [])]); setOlder(r.data.nextCursor); } }}>View earlier comments</button>
      )}
      {comments === null ? <p className="text-xs text-[#14301A]/60">Loading…</p> : comments.length === 0 ? <p className="text-xs text-[#14301A]/60">No comments yet. Be the first.</p> : (
        <ul className="space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
              <p className="min-w-0 break-words"><b className="font-semibold">{c.authorName}</b> <span className="opacity-90">{c.body}</span> <span className="text-xs text-[#14301A]/50">{timeAgo(new Date(c.createdAt))}</span></p>
              {c.mine ? (
                <button className="shrink-0 text-xs text-[#14301A]/50 hover:text-[#14301A]" onClick={async () => { const r = await deleteMyBrowseComment(c.id); if (r.success) { setComments((x) => (x ?? []).filter((y) => y.id !== c.id)); onCount(Math.max(0, post.commentCount - 1)); } else toast.error(r.error); }}>Delete</button>
              ) : <ReportMenu postId={post.id} commentId={c.id} label="Report this comment" />}
            </li>
          ))}
        </ul>
      )}
      <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Your name" autoComplete="given-name" />
        <div className="flex gap-2">
          <input className={input} placeholder="Add a comment…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={BROWSE_COMMENT_MAX} aria-label="Comment" />
          <button type="submit" disabled={pending || !body.trim()} className="shrink-0 rounded-xl bg-[#14301A] px-4 text-sm font-semibold text-[#FBF6E9] disabled:opacity-40">Post</button>
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
      else { setPost(prev); needAccountToast(r.error); }
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
    <article className="overflow-hidden rounded-[28px] bg-[#FBF6E9] pb-1 text-[#14301A] shadow-[0_18px_40px_-20px_rgba(0,0,0,.65)]" aria-label={`Post by ${post.store.name}`}>
      <header className="flex items-center gap-3 px-4 pb-3 pt-4">
        <Link href={storeBrowsePath(post.store.slug)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14301A]">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#14301A]/10 text-sm font-bold ring-2 ring-[#F5B82E] ring-offset-2 ring-offset-[#FBF6E9]">
            {post.store.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={post.store.logoUrl} alt="" className="h-full w-full object-cover" /> : post.store.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className={`${display} flex items-center gap-1 truncate text-[15px] font-bold leading-tight`}>{post.store.name}<StoreBadges verified={post.store.verified} mogul={post.store.mogul} official={isOfficialSlug(post.store.slug)} /></span>
            <span className="block truncate text-xs text-[#14301A]/60">{[post.store.category, post.store.city].filter(Boolean).join(", ")}{(post.store.category || post.store.city) ? ", " : ""}{timeAgo(new Date(post.createdAt))}</span>
          </span>
        </Link>
        <Link href={storeUrl} className="hidden shrink-0 items-center gap-1.5 rounded-full bg-[#14301A] px-3.5 py-2 text-xs font-semibold text-[#FBF6E9] hover:bg-[#0c1f11] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14301A] sm:inline-flex"><Store className="h-3.5 w-3.5" aria-hidden /> Visit store</Link>
        <ReportMenu postId={post.id} label="Report this post" />
      </header>

      <Images post={post} />

      <div className="flex items-center gap-1 px-2.5 pt-2.5">
        <button onClick={like} disabled={pending} aria-pressed={post.liked} aria-label={post.liked ? "Unlike" : "Like"} className={iconBtn}>
          <Heart className={`h-6 w-6 transition ${post.liked ? "fill-rose-500 text-rose-500" : ""}`} aria-hidden />
          <span>{compactCount(post.likeCount)}</span>
        </button>
        <button onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} aria-label="Comments" className={iconBtn}>
          <MessageCircle className="h-6 w-6" aria-hidden /><span>{compactCount(post.commentCount)}</span>
        </button>
        <button onClick={share} aria-label="Share" className={`${iconBtn} ml-auto`}><Share2 className="h-5 w-5" aria-hidden /></button>
      </div>

      {post.caption && (
        <div className="px-4 pb-4 pt-1 text-[15px] leading-relaxed">
          <p className={`whitespace-pre-line break-words ${!more && long ? "line-clamp-3" : ""}`}><Link href={storeUrl} className={`${display} font-bold hover:underline`}>{post.store.name}</Link> {post.caption}</p>
          {long && <button className="mt-1 text-xs font-medium text-[#14301A]/60 hover:text-[#14301A]" onClick={() => setMore((v) => !v)}>{more ? "Show less" : "Read more"}</button>}
        </div>
      )}
      {!post.caption && <div className="pb-3" />}

      {showComments && <Comments post={post} onCount={(n) => setPost((p) => ({ ...p, commentCount: n }))} />}
    </article>
  );
}
