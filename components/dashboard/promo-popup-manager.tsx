"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { savePromoPopup } from "@/lib/actions/promo-popup";
import { SingleImageUpload } from "@/components/forms/single-image-upload";
import { PromoCard } from "@/components/storefront/promo-popup";
import {
  PROMO_TARGET_OPTIONS,
  type PromoFrequency,
  type PromoLayout,
  type PromoPalette,
  type PromoPopupConfig,
  type PromoTrigger,
} from "@/lib/storefront/promo-popup";

const inputCls = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

const LAYOUTS: { id: PromoLayout; label: string; hint: string }[] = [
  { id: "center", label: "Centered", hint: "Modal in the middle" },
  { id: "split", label: "Split", hint: "Image beside text" },
  { id: "corner", label: "Corner", hint: "Small, non-blocking" },
];

export function PromoPopupManager({
  slug, initial, palette, templateName, coupons,
}: {
  slug: string;
  initial: PromoPopupConfig;
  palette: PromoPalette;
  templateName: string | null;
  coupons: { code: string; label: string }[];
}) {
  const [c, setC] = useState<PromoPopupConfig>(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof PromoPopupConfig>(k: K, v: PromoPopupConfig[K]) => setC((p) => ({ ...p, [k]: v }));

  // "custom" = typed https URL instead of a store page
  const isCustom = c.ctaTarget.startsWith("https://");
  const matchedCoupon = coupons.find((x) => x.code === c.couponCode);

  const save = () =>
    start(async () => {
      const r = await savePromoPopup(slug, c);
      if (r.success) {
        setC(r.data!);
        toast.success(c.enabled ? "Pop-up saved and live" : "Pop-up saved (currently off)");
      } else toast.error(r.error);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Promo pop-up</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A card shown to visitors on your storefront. It automatically matches your template
              {templateName ? ` (${templateName})` : ""}, and never appears on checkout, cart, account or admin pages.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={c.enabled} onChange={(e) => set("enabled", e.target.checked)} className="h-4 w-4" />
            Live
          </label>
        </div>

        <section className="space-y-4 rounded-lg border bg-background p-4">
          <div>
            <span className={labelCls}>Layout</span>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id} type="button" onClick={() => set("layout", l.id)}
                  className={`rounded-md border p-3 text-left text-sm ${c.layout === l.id ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  <span className="block font-medium">{l.label}</span>
                  <span className="block text-xs text-muted-foreground">{l.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Small label</label>
              <input className={inputCls} maxLength={40} value={c.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Limited offer" />
            </div>
            <div>
              <label className={labelCls}>Headline</label>
              <input className={inputCls} maxLength={90} value={c.headline} onChange={(e) => set("headline", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Message</label>
            <textarea className={inputCls} rows={3} maxLength={240} value={c.body} onChange={(e) => set("body", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Image (optional)</label>
            <SingleImageUpload value={c.imageUrl} onChange={(u) => set("imageUrl", u)} label="Upload promo image" />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border bg-background p-4">
          <div>
            <label className={labelCls}>Coupon code (optional)</label>
            <input
              className={`${inputCls} font-mono uppercase`} maxLength={32} value={c.couponCode}
              onChange={(e) => set("couponCode", e.target.value)} placeholder="WELCOME10" list="promo-coupons"
            />
            <datalist id="promo-coupons">
              {coupons.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
            </datalist>
            {c.couponCode && !matchedCoupon && (
              <p className="mt-1 text-xs text-amber-600">
                No active coupon with this code exists. Create it under Coupons or visitors will get an &ldquo;invalid code&rdquo; error.
              </p>
            )}
            {matchedCoupon && <p className="mt-1 text-xs text-muted-foreground">Matches an active coupon: {matchedCoupon.label}.</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Button text</label>
              <input className={inputCls} maxLength={28} value={c.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Button goes to</label>
              <select
                className={inputCls}
                value={isCustom ? "__custom" : c.ctaTarget}
                onChange={(e) => set("ctaTarget", e.target.value === "__custom" ? "https://" : e.target.value)}
              >
                <option value="">No button</option>
                {PROMO_TARGET_OPTIONS.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
                <option value="__custom">Custom link…</option>
              </select>
              {isCustom && (
                <input className={`${inputCls} mt-2`} value={c.ctaTarget} onChange={(e) => set("ctaTarget", e.target.value)} placeholder="https://" />
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>When to show</label>
            <select className={inputCls} value={c.trigger} onChange={(e) => set("trigger", e.target.value as PromoTrigger)}>
              <option value="delay">After a delay</option>
              <option value="scroll">After scrolling 40%</option>
              <option value="exit">When leaving (desktop; 15s on phones)</option>
            </select>
          </div>
          {c.trigger === "delay" && (
            <div>
              <label className={labelCls}>Delay (seconds)</label>
              <input type="number" min={0} max={120} className={inputCls} value={c.delaySeconds} onChange={(e) => set("delaySeconds", Number(e.target.value))} />
            </div>
          )}
          <div>
            <label className={labelCls}>Show again</label>
            <select className={inputCls} value={c.frequency} onChange={(e) => set("frequency", e.target.value as PromoFrequency)}>
              <option value="always">Every page load</option>
              <option value="session">Once per visit</option>
              <option value="daily">Once a day</option>
              <option value="weekly">Once a week</option>
              <option value="once">Only once, ever</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Stop showing after (optional)</label>
            <input type="date" className={inputCls} value={c.endsAt ? c.endsAt.slice(0, 10) : ""} onChange={(e) => set("endsAt", e.target.value ? `${e.target.value}T23:59:59` : "")} />
          </div>
        </section>

        <button
          type="button" onClick={save} disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save pop-up"}
        </button>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <p className={labelCls}>Preview — {templateName ?? "your template"}</p>
        <div className="rounded-lg border p-4" style={{ background: palette.bg }}>
          <div className={c.layout === "split" ? "" : "mx-auto max-w-sm"}>
            <PromoCard config={c} palette={palette} slug={slug} static />
          </div>
        </div>
        {!c.enabled && <p className="mt-2 text-xs text-muted-foreground">Turn on “Live” and save to show this to visitors.</p>}
      </aside>
    </div>
  );
}
