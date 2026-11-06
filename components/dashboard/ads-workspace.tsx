"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MultiImageUpload } from "@/components/forms/multi-image-upload";
import { createAdCampaign, discardUnpaidAd, payAdCampaign, setAdPaused } from "@/lib/actions/ads-vendor";
import {
  AD_CTAS, AD_CTA_LABEL, AD_DURATIONS, AD_FREQ_CAP, AD_MAX_BUDGET, AD_MIN_BUDGET, AD_PLACEMENTS, AD_PLACEMENT_LABEL, AD_RATE_PER_1000, impressionsFor, type AdPlacement,
} from "@/lib/ads";
import { STORY_BG_COLORS, STORY_TEXT_MAX, BROWSE_CAPTION_MAX } from "@/lib/browse";
import type { VendorAdView } from "@/lib/ads-data";
import { formatMoney } from "@/lib/utils/format-money";

const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60";
const ghost = "rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60";
const naira = (n: number) => formatMoney(n, "NGN");

const PAUSED_BY: Record<string, string> = { OWNER: "Paused by you", ADMIN: "Paused by BizNest", REPORTS: "Paused after reports, under review" };

function CampaignRow({ slug, c, run, pending }: { slug: string; c: VendorAdView; run: (fn: () => Promise<{ success: boolean; error?: string; data?: unknown }>, ok?: string) => void; pending: boolean }) {
  const pct = c.impressionsBought > 0 ? Math.min(100, Math.round((c.impressions / c.impressionsBought) * 100)) : 0;
  return (
    <li className="rounded-xl border p-4">
      <div className="flex gap-3">
        {c.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-lg bg-muted" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 whitespace-pre-line text-sm">{c.caption || <span className="text-muted-foreground">(photo only)</span>}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {AD_PLACEMENT_LABEL[c.placement]}{c.productName ? ` · ${c.productName}` : ""} ·{" "}
            <span className={c.status === "ACTIVE" ? "text-emerald-700" : c.status === "PAUSED" || c.status === "PENDING_PAYMENT" ? "text-amber-700" : ""}>{c.statusLabel}</span>
            {c.status === "PAUSED" && c.pausedBy ? ` (${PAUSED_BY[c.pausedBy] ?? ""})` : ""}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Spent</dt><dd className="font-medium">{naira(c.spent)} / {naira(c.budget)}</dd></div>
            <div><dt className="text-muted-foreground">{c.placement === "STORY" ? "Story views" : "Impressions"}</dt><dd className="font-medium">{c.impressions.toLocaleString("en-NG")} / {c.impressionsBought.toLocaleString("en-NG")}</dd></div>
            <div><dt className="text-muted-foreground">Clicks</dt><dd className="font-medium">{c.clicks.toLocaleString("en-NG")}</dd></div>
            <div><dt className="text-muted-foreground">Click rate</dt><dd className="font-medium">{c.ctr}%</dd></div>
          </dl>
          {c.endsAt && <p className="mt-1 text-xs text-muted-foreground">{c.status === "ACTIVE" || c.status === "PAUSED" ? "Ends" : "Ended"} {new Date(c.endsAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {c.status === "ACTIVE" && <button className={ghost} disabled={pending} onClick={() => run(() => setAdPaused(slug, c.id, true), "Ad paused.")}>Pause</button>}
            {c.status === "PAUSED" && c.pausedBy === "OWNER" && <button className={ghost} disabled={pending} onClick={() => run(() => setAdPaused(slug, c.id, false), "Ad running again.")}>Resume</button>}
            {c.status === "PENDING_PAYMENT" && (
              <>
                <button className={btn} disabled={pending} onClick={() => run(async () => { const r = await payAdCampaign(slug, c.id); if (r.success) window.location.href = r.data.authorizationUrl; return r; })}>Pay {naira(c.budget)}</button>
                <button className={ghost} disabled={pending} onClick={() => { if (confirm("Discard this unpaid ad?")) run(() => discardUnpaidAd(slug, c.id), "Discarded."); }}>Discard</button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function AdsWorkspace({ slug, campaigns, products, posts }: {
  slug: string; campaigns: VendorAdView[]; products: { id: string; name: string }[]; posts: { id: string; caption: string; images: string[] }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [placement, setPlacement] = useState<AdPlacement>("FEED");
  const [image, setImage] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [bg, setBg] = useState<string>(STORY_BG_COLORS[0]);
  const [cta, setCta] = useState<string>("SHOP_NOW");
  const [productId, setProductId] = useState("");
  const [budget, setBudget] = useState(5000);
  const [days, setDays] = useState<number>(7);

  const rate = AD_RATE_PER_1000[placement];
  const reach = useMemo(() => impressionsFor(budget, rate), [budget, rate]);
  const textOnly = placement === "STORY" && image.length === 0;

  const run = (fn: () => Promise<{ success: boolean; error?: string; data?: unknown }>, ok?: string, after?: () => void) => {
    setError(null); setNote(null);
    start(async () => {
      const r = await fn();
      if (!r.success) { setError(r.error ?? "Something went wrong."); return; }
      if (ok) setNote(ok);
      after?.();
      router.refresh();
    });
  };

  function fromPost(id: string) {
    const p = posts.find((x) => x.id === id);
    if (!p) return;
    setCaption(p.caption.slice(0, placement === "STORY" ? STORY_TEXT_MAX : BROWSE_CAPTION_MAX));
    setImage(p.images.slice(0, 1));
  }

  function launch() {
    setError(null); setNote(null);
    start(async () => {
      const r = await createAdCampaign(slug, { placement, caption, imageUrl: image[0] ?? null, bgColor: bg, ctaLabel: cta, productId: productId || null, budget, durationDays: days });
      if (!r.success) { setError(r.error); return; }
      window.location.href = r.data.authorizationUrl;
    });
  }

  const live = campaigns.filter((c) => ["ACTIVE", "PAUSED", "PENDING_PAYMENT"].includes(c.status));
  const past = campaigns.filter((c) => c.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-5">
        <h2 className="text-sm font-semibold">New ad</h2>
        <div className="mt-3 space-y-3">
          <div className="flex gap-2" role="tablist" aria-label="Where to show the ad">
            {AD_PLACEMENTS.map((p) => <button key={p} role="tab" aria-selected={placement === p} className={placement === p ? btn : ghost} onClick={() => setPlacement(p)}>{AD_PLACEMENT_LABEL[p]}</button>)}
          </div>
          <p className="text-xs text-muted-foreground">{placement === "FEED" ? "A sponsored post shown between posts in the Browse feed. Needs a photo." : "A sponsored ring in the story row. Counted when someone opens it. Photo or text card."}</p>

          {posts.length > 0 && (
            <label className="block text-xs">Start from one of your posts (optional)
              <select className={`${input} mt-1`} defaultValue="" onChange={(e) => fromPost(e.target.value)}>
                <option value="">Write a new ad</option>
                {posts.map((p) => <option key={p.id} value={p.id}>{p.caption.slice(0, 60) || "(photo only)"}</option>)}
              </select>
            </label>
          )}

          {textOnly ? (
            <div className="rounded-xl p-6 text-center text-white" style={{ background: bg }}>
              <textarea className="w-full resize-none bg-transparent text-center text-xl font-bold placeholder:text-white/60 focus:outline-none" rows={3} maxLength={STORY_TEXT_MAX} placeholder="This weekend only: 20% off" value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Ad text" />
              <div className="mt-3 flex justify-center gap-2">{STORY_BG_COLORS.map((c) => <button key={c} aria-label={`Background ${c}`} aria-pressed={bg === c} onClick={() => setBg(c)} className={`h-6 w-6 rounded-full border-2 ${bg === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />)}</div>
            </div>
          ) : (
            <textarea className={input} rows={3} maxLength={placement === "STORY" ? STORY_TEXT_MAX : BROWSE_CAPTION_MAX} placeholder="Say what you're offering. No links needed: people are taken to your store." value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Ad text" />
          )}
          <MultiImageUpload value={image} onChange={setImage} max={1} label={placement === "FEED" ? "Photo (required)" : "Photo (leave empty for a text card)"} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">Button
              <select className={`${input} mt-1`} value={cta} onChange={(e) => setCta(e.target.value)}>{AD_CTAS.map((c) => <option key={c} value={c}>{AD_CTA_LABEL[c]}</option>)}</select>
            </label>
            <label className="block text-xs">Send people to a product (optional)
              <select className={`${input} mt-1`} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">My store</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block text-xs">Budget (₦)
              <input className={`${input} mt-1`} type="number" min={AD_MIN_BUDGET} max={AD_MAX_BUDGET} step={500} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </label>
            <label className="block text-xs">Runs for
              <select className={`${input} mt-1`} value={days} onChange={(e) => setDays(Number(e.target.value))}>{AD_DURATIONS.map((d) => <option key={d} value={d}>{d} days</option>)}</select>
            </label>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs">
            <p><b>{reach.toLocaleString("en-NG")}</b> {placement === "STORY" ? "story views" : "impressions"} for <b>{naira(budget || 0)}</b> ({naira(rate)} per 1,000). The ad stops when the views are used up or after {days} days, whichever comes first.</p>
            <p className="mt-1 text-muted-foreground">One person sees the same ad up to {AD_FREQ_CAP} times a day. Your own views don&apos;t count. Ads are checked after people report them, and BizNest can pause or remove any ad that breaks the rules (unspent budget is refunded on removal).</p>
          </div>

          <div className="flex items-center gap-3">
            <button className={btn} disabled={pending || (!caption.trim() && image.length === 0)} onClick={launch}>{pending ? "Working…" : `Pay ${naira(budget || 0)} and start`}</button>
          </div>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          {note && <p role="status" className="text-xs text-emerald-700">{note}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Your ads</h2>
        {live.length === 0 ? <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No running ads yet.</p> : (
          <ul className="space-y-3">{live.map((c) => <CampaignRow key={c.id} slug={slug} c={c} run={run} pending={pending} />)}</ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Finished</h2>
          <ul className="space-y-3">{past.map((c) => <CampaignRow key={c.id} slug={slug} c={c} run={run} pending={pending} />)}</ul>
        </section>
      )}
    </div>
  );
}
