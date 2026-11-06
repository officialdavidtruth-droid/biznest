"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Flag, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { recordAdClick, recordAdImpression, reportAd } from "@/lib/actions/ads";
import type { AdPublic } from "@/lib/ads-data";
import { AD_CTA_LABEL, type AdCta } from "@/lib/ads";
import { REPORT_REASONS, REPORT_REASON_LABEL, storeBrowsePath, type ReportReason } from "@/lib/browse";
import { StoreBadges } from "@/components/browse/store-badges";
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
    <article ref={ref} className="overflow-hidden rounded-[28px] bg-[#FBF6E9] pb-1 text-[#14301A] shadow-[0_18px_40px_-20px_rgba(0,0,0,.65)]" aria-label={`Sponsored post by ${ad.store.name}`}>
      <header className="flex items-center gap-3 px-4 pb-3 pt-4">
        <Link href={storeBrowsePath(ad.store.slug)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14301A]">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#14301A]/10 text-sm font-bold ring-2 ring-[#14301A]/20 ring-offset-2 ring-offset-[#FBF6E9]">
            {ad.store.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ad.store.logoUrl} alt="" className="h-full w-full object-cover" /> : ad.store.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 truncate font-[family-name:var(--font-browse-display)] text-[15px] font-bold leading-tight">{ad.store.name}<StoreBadges verified={ad.store.verified} mogul={ad.store.mogul} /></span>
            <span className="mt-0.5 inline-block rounded-full border border-[#14301A]/25 px-2 py-px text-[11px] font-medium text-[#14301A]/70">Sponsored</span>
          </span>
        </Link>
        <span className="relative">
          <button type="button" onClick={() => setMenu((v) => !v)} className="inline-flex items-center gap-1 rounded-full p-1.5 text-xs text-[#14301A]/55 hover:bg-[#14301A]/5 hover:text-[#14301A]" aria-label="Report this ad" aria-expanded={menu}><Flag className="h-3.5 w-3.5" aria-hidden /></button>
          {menu && (
            <span className="absolute right-0 top-8 z-20 flex w-44 flex-col rounded-2xl border border-[#14301A]/10 bg-white p-1 text-xs text-[#14301A] shadow-xl" role="menu">
              {REPORT_REASONS.map((r) => (
                <button key={r} role="menuitem" disabled={pending} className="rounded-xl px-3 py-2 text-left hover:bg-[#14301A]/5"
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
        <div className="relative px-3">
          <Link href={dest} onClick={click} className="relative block aspect-[4/5] w-full overflow-hidden rounded-[22px] bg-[#14301A]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]" aria-label={`Open ${ad.store.name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ad.imageUrl} alt={ad.caption?.slice(0, 80) ?? `Ad from ${ad.store.name}`} loading="lazy" className="h-full w-full object-cover" />
          </Link>
          {ad.product && (
            <Link href={dest} onClick={click} className="absolute bottom-4 left-6 flex max-w-[78%] items-center gap-2 rounded-full bg-[#F5B82E] py-2 pl-3 pr-4 text-[#14301A] shadow-lg ring-1 ring-black/10">
              <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate text-sm font-semibold">{ad.product.name}</span>
              {ad.product.price != null && <span className="shrink-0 text-sm font-extrabold">{formatMoney(ad.product.price, ad.product.currency)}</span>}
            </Link>
          )}
        </div>
      )}

      {ad.caption && <p className="whitespace-pre-line break-words px-4 pt-3 text-[15px] leading-relaxed"><span className="font-[family-name:var(--font-browse-display)] font-bold">{ad.store.name}</span> {ad.caption}</p>}
      <div className="p-4">
        <Link href={dest} onClick={click} className="block rounded-full bg-[#14301A] py-3 text-center text-sm font-semibold text-[#FBF6E9] hover:bg-[#0c1f11] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14301A]">{adCtaText(ad)}</Link>
      </div>
    </article>
  );
}
