"use client";

import { useState, useTransition } from "react";
import { saveTrackingIds } from "@/lib/actions/tracking";
import type { TrackingIds } from "@/lib/tracking/ids";

type Msg = { kind: "ok" | "error"; text: string; field?: keyof TrackingIds } | null;

export function TrackingIdsForm({ slug, initial }: { slug: string; initial: TrackingIds }) {
  const [gaId, setGaId] = useState(initial.gaId ?? "");
  const [metaPixelId, setMetaPixelId] = useState(initial.metaPixelId ?? "");
  const [plausibleDomain, setPlausibleDomain] = useState(initial.plausibleDomain ?? "");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await saveTrackingIds(slug, { gaId, metaPixelId, plausibleDomain });
      if (!r.success) {
        setMsg({ kind: "error", text: r.error, field: r.field });
        return;
      }
      // Show the cleaned-up values (e.g. "https://MyStore.com/" -> "mystore.com").
      setGaId(r.data.gaId ?? "");
      setMetaPixelId(r.data.metaPixelId ?? "");
      setPlausibleDomain(r.data.plausibleDomain ?? "");
      setMsg({ kind: "ok", text: "Saved. Tracking is live on your storefront." });
    });

  const input = "w-full rounded-md border px-3 py-1.5 text-sm";
  const err = (f: keyof TrackingIds) => msg?.kind === "error" && msg.field === f;

  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-1 text-sm font-medium">Tracking &amp; analytics</p>
      <p className="mb-4 text-xs text-muted-foreground">
        See where your visitors come from and measure your ads. Add any of these and your storefront reports page views,
        product views, add-to-cart, checkout and completed orders or bookings to them. Leave a box empty to switch it off.
        Your dashboard and customer account pages are never tracked.
      </p>

      <label className="mb-1 block text-xs text-muted-foreground" htmlFor="trk-ga">Google Analytics 4 Measurement ID</label>
      <input
        id="trk-ga"
        value={gaId}
        onChange={(e) => setGaId(e.target.value)}
        placeholder="G-ABC123XYZ9"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={err("gaId")}
        className={`${input} ${err("gaId") ? "border-destructive" : ""}`}
      />
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Google Analytics → Admin → Data streams → your web stream. It starts with <code className="rounded bg-muted px-1">G-</code>.
      </p>

      <label className="mb-1 block text-xs text-muted-foreground" htmlFor="trk-meta">Meta (Facebook &amp; Instagram) Pixel ID</label>
      <input
        id="trk-meta"
        value={metaPixelId}
        onChange={(e) => setMetaPixelId(e.target.value)}
        placeholder="123456789012345"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={err("metaPixelId")}
        className={`${input} ${err("metaPixelId") ? "border-destructive" : ""}`}
      />
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Meta Events Manager → Data sources → your Pixel. It is a number only. Enables ad conversion tracking and retargeting.
      </p>

      <label className="mb-1 block text-xs text-muted-foreground" htmlFor="trk-plausible">Plausible site domain</label>
      <input
        id="trk-plausible"
        value={plausibleDomain}
        onChange={(e) => setPlausibleDomain(e.target.value)}
        placeholder="yourstore.com"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={err("plausibleDomain")}
        className={`${input} ${err("plausibleDomain") ? "border-destructive" : ""}`}
      />
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        The domain exactly as you added it in your Plausible account. Cookie-free analytics.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save tracking IDs"}
        </button>
        {msg && (
          <p role="status" className={`text-xs font-medium ${msg.kind === "ok" ? "text-primary" : "text-destructive"}`}>
            {msg.text}
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        BizNest sends these tools product names, prices and order totals, never customer names, emails or phone numbers. If you serve visitors in regions that require cookie consent, make sure your privacy policy covers these tools.
      </p>
    </div>
  );
}
