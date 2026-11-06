"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Flag, Pause, X } from "lucide-react";
import { toast } from "sonner";
import { markStoryViewed, reportBrowse } from "@/lib/actions/browse";
import { recordAdClick, recordAdImpression, reportAd } from "@/lib/actions/ads";
import type { StoryRing } from "@/lib/browse-data";
import { REPORT_REASONS, REPORT_REASON_LABEL, STORY_SECONDS, isOfficialSlug, storeBrowsePath, timeAgo, type ReportReason } from "@/lib/browse";
import { StoreBadges } from "@/components/browse/store-badges";
import { formatMoney } from "@/lib/utils/format-money";
import { storeHref } from "@/lib/utils/store-href";

function Avatar({ ring, size }: { ring: StoryRing; size: number }) {
  return (
    <span className="grid place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-bold" style={{ width: size, height: size }}>
      {ring.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ring.logoUrl} alt="" className="h-full w-full object-cover" /> : ring.storeName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function RingFrame({ seen, children }: { seen: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded-full p-[3px] transition group-hover:scale-105 ${seen ? "bg-white/25" : "bg-gradient-to-tr from-[#F5B82E] via-[#F2704B] to-[#E5484D]"}`}>
      <span className="block rounded-full bg-[#0A2012] p-[3px]">{children}</span>
    </span>
  );
}

function Viewer({ rings, start, onClose, onSeen }: { rings: StoryRing[]; start: number; onClose: () => void; onSeen: (storyId: string) => void }) {
  const [r, setR] = useState(start);
  const [s, setS] = useState(() => {
    const first = rings[start]?.stories.findIndex((x) => !x.seen) ?? -1;
    return first < 0 ? 0 : first;
  });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reporting, setReporting] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const ring = rings[r];
  const story = ring?.stories[s];

  const next = useCallback(() => {
    setProgress(0); setReporting(false);
    if (s + 1 < ring.stories.length) setS(s + 1);
    else if (r + 1 < rings.length) { setR(r + 1); setS(Math.max(0, rings[r + 1].stories.findIndex((x) => !x.seen))); }
    else onClose();
  }, [s, r, ring, rings, onClose]);
  const prev = useCallback(() => {
    setProgress(0); setReporting(false);
    if (s > 0) setS(s - 1);
    else if (r > 0) { setR(r - 1); setS(rings[r - 1].stories.length - 1); }
  }, [s, r, rings]);

  // Count the view once the story is on screen.
  useEffect(() => { if (story) { if (story.ad) void recordAdImpression(story.ad.id); else void markStoryViewed(story.id); onSeen(story.id); } }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress clock.
  useEffect(() => {
    if (paused || reporting || !story) return;
    const t = setInterval(() => setProgress((p) => Math.min(1, p + 0.1 / STORY_SECONDS)), 100);
    return () => clearInterval(t);
  }, [paused, reporting, story]);
  useEffect(() => { if (progress >= 1) next(); }, [progress, next]);

  // Keyboard + scroll lock + focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [next, prev, onClose]);

  if (!ring || !story) return null;
  const storeUrl = storeHref(ring.storeSlug);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${ring.storeName} story`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <div className="relative flex h-full w-full max-w-md select-none flex-col overflow-hidden bg-black sm:h-[92vh] sm:rounded-2xl">
        <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-3" aria-hidden>
          {ring.stories.map((x, i) => (
            <span key={x.id} className="h-0.5 flex-1 overflow-hidden rounded bg-white/30">
              <span className="block h-full bg-white" style={{ width: `${i < s ? 100 : i === s ? progress * 100 : 0}%` }} />
            </span>
          ))}
        </div>
        <div className="absolute left-0 right-0 top-5 z-20 flex items-center gap-3 px-3 text-white">
          <Link href={storeBrowsePath(ring.storeSlug)} className="flex min-w-0 flex-1 items-center gap-2">
            <Avatar ring={ring} size={36} />
            <span className="min-w-0 truncate text-sm font-semibold drop-shadow">{ring.storeName}<span className="ml-1 inline-flex align-middle"><StoreBadges verified={ring.verified} mogul={ring.mogul} official={isOfficialSlug(ring.storeSlug)} dark /></span><span className="ml-2 font-normal opacity-70">{story.ad ? "Sponsored" : timeAgo(new Date(story.createdAt))}</span></span>
          </Link>
          {paused && <Pause className="h-4 w-4 opacity-70" aria-label="Paused" />}
          <button onClick={() => setReporting((v) => !v)} aria-label="Report this story" className="p-1 opacity-80 hover:opacity-100"><Flag className="h-5 w-5" /></button>
          <button ref={closeRef} onClick={onClose} aria-label="Close stories" className="p-1"><X className="h-6 w-6" /></button>
        </div>

        <div className="relative flex-1" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
          {story.kind === "IMAGE" && story.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={story.imageUrl} alt={story.text ?? `Story from ${ring.storeName}`} className="absolute inset-0 h-full w-full object-contain" /> : (
            <div className="absolute inset-0 grid place-items-center p-8 text-center" style={{ background: story.bgColor ?? "#0f3d1e" }}>
              <p className="whitespace-pre-line break-words text-2xl font-bold leading-snug text-white">{story.text}</p>
            </div>
          )}
          {story.kind === "IMAGE" && story.text && <p className="absolute inset-x-0 bottom-28 mx-4 whitespace-pre-line break-words rounded-xl bg-black/50 p-3 text-center text-sm text-white">{story.text}</p>}
          <button aria-label="Previous story" onClick={prev} className="absolute inset-y-16 left-0 w-1/3" />
          <button aria-label="Next story" onClick={next} className="absolute inset-y-16 right-0 w-1/3" />
        </div>

        {reporting && (
          <div className="absolute inset-x-4 bottom-28 z-30 rounded-2xl border border-white/15 bg-[#0d2a0f] p-2 text-sm text-white shadow-xl" role="menu">
            <p className="px-3 py-2 text-xs opacity-70">Why are you reporting this story?</p>
            {REPORT_REASONS.map((x) => (
              <button key={x} role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
                onClick={async () => { const res = story.ad ? await reportAd(story.ad.id, x) : await reportBrowse({ storyId: story.id, reason: x as ReportReason }); setReporting(false); if (res.success) toast.success("Thanks. We'll take a look."); else toast.error(res.error); }}>{REPORT_REASON_LABEL[x]}</button>
            ))}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/90 to-transparent p-4 pt-10">
          {story.ad && (
            <Link href={story.product ? storeHref(ring.storeSlug, `/product/${story.product.id}`) : storeUrl} onClick={() => { void recordAdClick(story.ad!.id); }} className="rounded-full bg-white py-3 text-center text-sm font-semibold text-black">{story.ad.cta}</Link>
          )}
          {!story.ad && story.product && (
            <Link href={storeHref(ring.storeSlug, `/product/${story.product.id}`)} className="flex items-center justify-between gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">
              <span className="truncate">{story.product.name}</span>
              <span className="shrink-0">{story.product.price != null ? formatMoney(story.product.price, story.product.currency) : "View"}</span>
            </Link>
          )}
          {!story.ad && <Link href={storeUrl} className="rounded-full border border-white/40 py-2.5 text-center text-sm font-semibold text-white">Visit {ring.storeName}</Link>}
        </div>
      </div>
    </div>
  );
}

/** The ring row above the feed. `size="lg"` renders one large ring (used on a store's profile). */
export function StoryRings({ rings: initial, size = "sm" }: { rings: StoryRing[]; size?: "sm" | "lg" }) {
  const [rings, setRings] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);

  const onSeen = useCallback((storyId: string) => {
    setRings((cur) => cur.map((rg) => {
      if (!rg.stories.some((x) => x.id === storyId && !x.seen)) return rg;
      const stories = rg.stories.map((x) => (x.id === storyId ? { ...x, seen: true } : x));
      return { ...rg, stories, allSeen: stories.every((x) => x.seen) };
    }));
  }, []);

  if (rings.length === 0) return null;
  const px = size === "lg" ? 104 : 68;
  return (
    <>
      <div className={size === "lg" ? "" : "mb-5 flex gap-5 overflow-x-auto rounded-[28px] border border-white/10 bg-black/20 px-5 py-4 [scrollbar-width:none]"} aria-label="Stories">
        {rings.map((rg, i) => (
          <button key={rg.sponsored ? `ad:${rg.stories[0]?.id}` : rg.storeSlug} onClick={() => setOpen(i)} className="group flex shrink-0 flex-col items-center gap-2 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F5B82E]" aria-label={`${rg.storeName}: ${rg.stories.length} stor${rg.stories.length === 1 ? "y" : "ies"}${rg.allSeen ? "" : ", new"}`}>
            <RingFrame seen={rg.allSeen}><Avatar ring={rg} size={px} /></RingFrame>
            {size === "sm" && <span className="w-[76px] truncate text-center text-xs font-medium text-[#FBF6E9]/85">{rg.sponsored ? "Sponsored" : rg.storeName}</span>}
          </button>
        ))}
      </div>
      {open !== null && <Viewer rings={rings} start={open} onClose={() => setOpen(null)} onSeen={onSeen} />}
    </>
  );
}
