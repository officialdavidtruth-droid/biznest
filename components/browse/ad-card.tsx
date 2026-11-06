"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, Flag, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { recordAdClick, recordAdImpression, reportAd } from "@/lib/actions/ads";
import type { AdPublic } from "@/lib/ads-data";
import { AD_CTA_LABEL, type AdCta } from "@/lib/ads";
import { REPORT_REASONS, REPORT_REASON_LABEL, storeBrowsePath, type ReportReason } from "@/lib/browse";
import { formatMoney } from "@/lib/utils/format-money";
import { storeHref } from "@/lib/utils/store-href";

export const adDestination = (ad: AdPublic) => (ad.product ? storeHref(ad.store.slug, `/product/${ad.product.id}`) : storeHref(ad.store.slug));
export const adCtaText = (ad: AdPublic) => AD_CTA_LABEL[ad.ctaLabel as AdCta] ?? "Learn more";

/** A sponsored post in the feed. The impression is counted once it has been at least half on screen for a second. */
export function AdCard({ ad }: { ad: AdPublic }) {
  const ref = useRef<HTMLElement>(null);
  const counted = useRef(false);
  const [menu, setMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const el = ref.current;
    if (!el || counted.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver((entries) => {
      const visible = entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.5;
      if (visible && !counted.current && !timer) {
        timer = setTimeout(() => { counted.current = true; void recordAdImpression(ad.id); io.disconnect(); }, 1000);
      } else if (!visible && timer) { clearTimeout(timer); timer = undefined; }
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => { if (timer) clearTimeout(timer); io.disconnect(); };
  }, [ad.id]);

  if (hidden) return null;
  const dest = adDestination(ad);
  const click = () => { void recordAdClick(ad.id); };

  return (
    <article ref={ref} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]" aria-label={`Sponsored post by ${ad.store.name}`}>
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href={storeBrowsePath(ad.store.slug)} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-bold">
            {ad.store.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ad.store.logoUrl} alt="" className="h-full w-full object-cover" /> : ad.store.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 truncate text-sm font-semibold">{ad.store.name}{ad.store.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-label="Verified business" />}</span>
            <span className="block text-xs opacity-60">Sponsored</span>
          </span>
        </Link>
        <span className="relative">
          <button type="button" onClick={() => setMenu((v) => !v)} className="inline-flex items-center gap-1 text-xs opacity-60 hover:opacity-100" aria-label="Report this ad" aria-expanded={menu}><Flag className="h-3.5 w-3.5" aria-hidden /> Report</button>
          {menu && (
            <span className="absolute right-0 top-6 z-20 flex w-44 flex-col rounded-xl border border-white/15 bg-[#0d2a0f] p-1 text-xs shadow-xl" role="menu">
              {REPORT_REASONS.map((r) => (
                <button key={r} role="menuitem" disabled={pending} className="rounded-lg px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => start(async () => {
                    const res = await reportAd(ad.id, r as ReportReason);
                    setMenu(false);
                    if (res.success) { toast.success("Thanks. We'll take a look."); setHidden(true); } else toast.error(res.error);
                  })}>{REPORT_REASON_LABEL[r]}</button>
              ))}
            </span>
          )}
        </span>
      </header>

      {ad.imageUrl && (
        <Link href={dest} onClick={click} className="relative block aspect-square w-full bg-white/5" aria-label={`Open ${ad.store.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.imageUrl} alt={ad.caption?.slice(0, 80) ?? `Ad from ${ad.store.name}`} loading="lazy" className="h-full w-full object-cover" />
        </Link>
      )}

      {ad.product && (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-2"><ShoppingBag className="h-4 w-4 shrink-0 opacity-70" /><span className="truncate font-medium">{ad.product.name}</span></span>
          <span className="shrink-0 font-semibold">{ad.product.price != null ? formatMoney(ad.product.price, ad.product.currency) : ""}</span>
        </div>
      )}

      {ad.caption && <p className="whitespace-pre-line break-words px-4 pt-3 text-sm"><span className="font-semibold">{ad.store.name}</span> {ad.caption}</p>}
      <div className="p-4">
        <Link href={dest} onClick={click} className="block rounded-full bg-white py-2.5 text-center text-sm font-semibold text-black">{adCtaText(ad)}</Link>
      </div>
    </article>
  );
}
