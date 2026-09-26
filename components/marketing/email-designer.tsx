"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Download, Image as ImageIcon, Monitor, Palette, Plus, RotateCcw, Smartphone, Sparkles, Trash2, Type } from "lucide-react";
import {
  MARKETING_CATEGORIES,
  MARKETING_FONT_OPTIONS,
  MARKETING_LIMITS,
  curateMarketingTemplates,
  defaultMarketingContent,
  getMarketingTemplate,
  normalizeMarketingContent,
  renderMarketingEmail,
  type MarketingBrand,
  type MarketingCampaignInput,
  type MarketingContent,
  type MarketingItem,
  type MarketingPhoto,
  type MarketingSection,
  type MarketingStyle,
  type MarketingTemplateCategory,
  type MarketingTemplateId,
} from "@/lib/email/marketing-templates";

/* -------------------------------------------------------------------------- */
/*  State                                                                      */
/* -------------------------------------------------------------------------- */

export type FeaturedItem = MarketingItem & { uid: string };
export type StorySection = MarketingSection & { uid: string };
export type GalleryPhoto = MarketingPhoto & { uid: string };

const TEXT_KEYS = [
  "subject", "previewText", "eyebrow", "headline", "body", "ctaLabel", "ctaUrl", "imageUrl",
  "secondaryCtaLabel", "secondaryCtaUrl", "offerLabel", "couponCode", "offerNote",
  "eventDate", "eventTime", "eventLocation", "signature", "closingNote",
  "galleryTitle", "bannerImageUrl", "bannerLinkUrl",
] as const;
type TextKey = (typeof TEXT_KEYS)[number];

type Overrides = Partial<Record<TextKey, string>> & { highlights?: string[]; items?: FeaturedItem[]; sections?: StorySection[]; gallery?: GalleryPhoto[] };

/** Sample values a merchant must replace before sending. */
const SAMPLE_KEYS: Array<{ key: "offerLabel" | "couponCode" | "eventDate" | "eventTime"; group: "offer" | "event"; label: string }> = [
  { key: "offerLabel", group: "offer", label: "offer" },
  { key: "couponCode", group: "offer", label: "discount code" },
  { key: "eventDate", group: "event", label: "event date" },
  { key: "eventTime", group: "event", label: "event time" },
];

export type EmailDesign = ReturnType<typeof useEmailDesign>;

/**
 * Editing model: the chosen design supplies starter copy ("defaults"); anything the
 * merchant types is stored as an override and survives switching designs, so
 * trying another layout never throws away their wording.
 */
export function useEmailDesign(brand: MarketingBrand, storeItems: MarketingItem[]) {
  const curated = useMemo(() => curateMarketingTemplates(brand, storeItems), [brand, storeItems]);
  const [template, setTemplate] = useState<MarketingTemplateId>(() => curated[0]?.id ?? "editorial");
  const [overrides, setOverrides] = useState<Overrides>({});
  const [style, setStyle] = useState<MarketingStyle>({});
  const meta = getMarketingTemplate(template);

  useEffect(() => {
    if (!curated.some((t) => t.id === template)) setTemplate(curated[0]?.id ?? "editorial");
  }, [curated, template]);

  const defaults = useMemo(() => defaultMarketingContent(template, brand, storeItems), [template, brand, storeItems]);
  const defaultFeatured = useMemo<FeaturedItem[]>(
    () => defaults.items.map((item, i) => {
      const at = storeItems.indexOf(item);
      return { ...item, uid: at >= 0 ? `src-${at}` : `d-${i}` };
    }),
    [defaults, storeItems]
  );
  const defaultSections = useMemo<StorySection[]>(
    () => (defaults.sections ?? []).map((sec, i) => ({ ...sec, uid: `ds-${i}` })),
    [defaults]
  );
  const defaultGallery = useMemo<GalleryPhoto[]>(
    () => (defaults.gallery ?? []).map((ph, i) => ({ ...ph, uid: `dg-${i}` })),
    [defaults]
  );

  const text = (key: TextKey): string => {
    const o = overrides[key];
    if (o !== undefined) return o;
    const d = (defaults as Record<string, unknown>)[key];
    return typeof d === "string" ? d : "";
  };
  const featured = overrides.items ?? defaultFeatured;
  const highlights = overrides.highlights ?? defaults.highlights ?? [];
  const sections = overrides.sections ?? defaultSections;
  const gallery = overrides.gallery ?? defaultGallery;

  const content: MarketingContent = {
    eyebrow: text("eyebrow"),
    headline: text("headline"),
    body: text("body"),
    ctaLabel: text("ctaLabel"),
    ctaUrl: text("ctaUrl"),
    imageUrl: text("imageUrl") || null,
    previewText: text("previewText"),
    secondaryCtaLabel: text("secondaryCtaLabel"),
    secondaryCtaUrl: text("secondaryCtaUrl"),
    offerLabel: text("offerLabel"),
    couponCode: text("couponCode"),
    offerNote: text("offerNote"),
    eventDate: text("eventDate"),
    eventTime: text("eventTime"),
    eventLocation: text("eventLocation"),
    signature: text("signature"),
    closingNote: text("closingNote"),
    highlights,
    items: featured.map(({ uid: _uid, ...item }) => item),
    sections: sections.map(({ uid: _uid, ...sec }) => sec),
    gallery: gallery.map(({ uid: _uid, ...ph }) => ph),
    galleryTitle: text("galleryTitle"),
    bannerImageUrl: text("bannerImageUrl") || undefined,
    bannerLinkUrl: text("bannerLinkUrl"),
    style,
  };

  const usesItems = meta.extras.includes("items");
  const usesSections = meta.extras.includes("sections");
  const usesGallery = meta.extras.includes("gallery");
  const usesBanner = meta.extras.includes("banner");
  const subject = text("subject");

  function render(opts?: { unsubscribeUrl?: string }) {
    // assetBaseUrl: "" keeps built-in stock images as relative /marketing-generated/
    // URLs, which previewifyEmailHtml() below then points at the current origin for
    // the sandboxed preview iframe. Without this they resolve to the production
    // APP_URL default, which 404s until that build is deployed there. The actual
    // send path (lib/email/send.ts) and automation engine call renderMarketingEmail
    // directly and correctly keep the APP_URL-absolute default for real inboxes.
    return renderMarketingEmail(template, brand, content, { unsubscribeUrl: opts?.unsubscribeUrl ?? "#", assetBaseUrl: "" });
  }

  /** Values still showing the design's placeholder offer/event details. */
  const sampleWarnings = SAMPLE_KEYS.filter(({ key, group }) => meta.extras.includes(group) && overrides[key] === undefined && Boolean((defaults as Record<string, unknown>)[key])).map((s) => s.label);

  const input: MarketingCampaignInput = { ...content, template, subject, items: usesItems ? content.items : [] };

  return {
    brand, storeItems, template, meta, subject, content, featured, highlights, sections, gallery, style, overrides, defaults, input, sampleWarnings, usesItems, usesSections, usesGallery, usesBanner, curated,
    setTemplate,
    text,
    setText: (key: TextKey, value: string) => setOverrides((o) => ({ ...o, [key]: value })),
    setHighlights: (list: string[]) => setOverrides((o) => ({ ...o, highlights: list })),
    setFeatured: (list: FeaturedItem[]) => setOverrides((o) => ({ ...o, items: list.slice(0, MARKETING_LIMITS.items) })),
    setSections: (list: StorySection[]) => setOverrides((o) => ({ ...o, sections: list.slice(0, MARKETING_LIMITS.sections) })),
    setGallery: (list: GalleryPhoto[]) => setOverrides((o) => ({ ...o, gallery: list.slice(0, MARKETING_LIMITS.gallery) })),
    patchStyle: (patch: Partial<MarketingStyle>) =>
      setStyle((s) => {
        const next: Record<string, unknown> = { ...s, ...patch };
        for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
        return next as MarketingStyle;
      }),
    reset: () => { setOverrides({}); setStyle({}); },
    /** Load a previously sent campaign back into the editor (as the starting point for a new one). */
    loadFrom: (raw: unknown) => {
      const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const c = normalizeMarketingContent(r);
      const next: Overrides = { subject: typeof r.subject === "string" ? r.subject : "" };
      for (const k of TEXT_KEYS) {
        if (k === "subject") continue;
        const v = k === "imageUrl" ? c.imageUrl ?? "" : (c as unknown as Record<string, unknown>)[k];
        next[k] = typeof v === "string" ? v : "";
      }
      next.highlights = c.highlights ?? [];
      const stamp = Date.now();
      next.items = c.items.map((item, i) => ({ ...item, uid: `re-${stamp}-${i}` }));
      next.sections = (c.sections ?? []).map((sec, i) => ({ ...sec, uid: `res-${stamp}-${i}` }));
      next.gallery = (c.gallery ?? []).map((ph, i) => ({ ...ph, uid: `reg-${stamp}-${i}` }));
      setTemplate(getMarketingTemplate(String(r.template)).id);
      setOverrides(next);
      setStyle(c.style ?? {});
    },
    isEdited: Object.keys(overrides).length > 0 || Object.keys(style).length > 0,
    render,
  };
}

/* -------------------------------------------------------------------------- */
/*  Look & feel                                                                */
/* -------------------------------------------------------------------------- */

export type DesignerVariant = "admin" | "dark";

const UI = {
  admin: {
    card: "rounded-2xl border bg-background p-5",
    title: "text-sm font-semibold",
    sub: "text-xs text-muted-foreground",
    label: "text-xs font-medium",
    input: "w-full min-w-0 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary",
    btn: "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:border-primary disabled:opacity-50",
    tile: "rounded-xl border p-2 text-left transition hover:border-primary/50",
    tileOn: "rounded-xl border border-primary bg-[hsl(var(--primary)/0.1)] p-2 text-left transition",
    chip: "rounded-full border px-3 py-1 text-xs font-medium hover:border-primary/50",
    chipOn: "rounded-full border border-primary bg-[hsl(var(--primary)/0.1)] px-3 py-1 text-xs font-semibold text-primary",
    accent: "text-primary",
    nested: "rounded-xl border p-3",
    seg: "inline-flex overflow-hidden rounded-lg border text-xs font-semibold",
    segOn: "bg-primary text-primary-foreground",
    segOff: "hover:bg-muted",
    badge: "rounded-full bg-muted px-2 py-1 text-[10px] font-semibold",
    frameWrap: "overflow-hidden rounded-2xl border bg-[var(--bn-admin-surface-2)] p-3 shadow-sm",
    frameBg: "bg-[var(--bn-admin-surface)]",
    thumbBg: "bg-white",
    warn: "border-amber-500/40 bg-amber-500/10",
    primary: "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50",
    step: "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition hover:border-primary/50",
    stepOn: "flex items-center gap-2 rounded-xl border border-primary bg-[hsl(var(--primary)/0.1)] px-3 py-2 text-left text-sm font-semibold text-primary",
    num: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold",
    numOn: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground",
    divider: "border-t",
  },
  dark: {
    card: "rounded-2xl border border-slate-700 bg-slate-900 p-6",
    title: "text-base font-bold text-white",
    sub: "text-xs text-slate-400",
    label: "text-xs font-medium text-slate-200",
    input: "w-full min-w-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:border-orange-400",
    btn: "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:border-orange-400 disabled:opacity-50",
    tile: "rounded-xl border border-slate-700 bg-slate-800 p-2 text-left transition hover:border-orange-400/60",
    tileOn: "rounded-xl border border-orange-400 bg-orange-500/10 p-2 text-left transition",
    chip: "rounded-full border border-slate-600 px-3 py-1 text-xs font-medium text-slate-200 hover:border-orange-400/60",
    chipOn: "rounded-full border border-orange-400 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300",
    accent: "text-orange-400",
    nested: "rounded-xl border border-slate-700 bg-slate-800/60 p-3",
    seg: "inline-flex overflow-hidden rounded-lg border border-slate-600 text-xs font-semibold text-slate-200",
    segOn: "bg-orange-500 text-slate-950",
    segOff: "hover:bg-slate-800",
    badge: "rounded-full bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200",
    frameWrap: "overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 p-3 shadow-sm",
    frameBg: "bg-white",
    thumbBg: "bg-white",
    warn: "border-amber-400/40 bg-amber-500/10",
    primary: "inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 disabled:opacity-50",
    step: "flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-200 transition hover:border-orange-400/60",
    stepOn: "flex items-center gap-2 rounded-xl border border-orange-400 bg-orange-500/10 px-3 py-2 text-left text-sm font-semibold text-orange-300",
    num: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold text-slate-200",
    numOn: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-slate-950",
    divider: "border-t border-slate-700",
  },
} as const;
type Tokens = (typeof UI)[DesignerVariant];

function previewifyEmailHtml(html: string): string {
  // srcDoc is sandboxed, so relative /marketing-generated assets otherwise resolve
  // against about:srcdoc. Point built-in assets at the current BizNest origin for
  // the live editor while keeping the exported/sent HTML unchanged.
  if (typeof window === "undefined") return html;
  return html.replace(/src=(\"|')\/marketing-generated\//g, `src=$1${window.location.origin}/marketing-generated/`);
}

function darkenEmailPreview(html: string): string {
  // Preview-only: flips the light email to dark to match a dark dashboard. Never touches what is sent.
  const css = `<style>html,body{filter:invert(1) hue-rotate(180deg);background:#fff !important}img,svg,video,picture,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${css}</head>`) : `${css}${html}`;
}

function hex6(value: string | undefined, fallback: string) {
  let h = (value ?? "").replace("#", "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((x) => x + x).join("");
  return /^[0-9a-f]{6}/i.test(h) ? `#${h.slice(0, 6).toLowerCase()}` : fallback;
}

async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a JPG, PNG or WebP image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image must be 10MB or smaller.");
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.url) throw new Error(result?.error || "Image upload failed.");
  return result.url as string;
}

/* -------------------------------------------------------------------------- */
/*  Small controls                                                             */
/* -------------------------------------------------------------------------- */

function Field({ ui, label, value, onChange, placeholder, hint, max }: { ui: Tokens; label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; max?: number }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className={ui.label}>{label}</span>
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={ui.input} />
      {hint && <span className={ui.sub}>{hint}</span>}
    </label>
  );
}

function Area({ ui, label, value, onChange, rows = 4, hint, max, placeholder }: { ui: Tokens; label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string; max?: number; placeholder?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className={ui.label}>{label}</span>
      <textarea value={value} rows={rows} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={ui.input} />
      {hint && <span className={ui.sub}>{hint}</span>}
    </label>
  );
}

function Segmented<T extends string>({ ui, value, options, onChange, label }: { ui: Tokens; value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="grid gap-1.5">
      <span className={ui.label}>{label}</span>
      <div className={ui.seg} role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className={`px-3 py-1.5 ${value === o.id ? ui.segOn : ui.segOff}`}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function ColorField({ ui, label, value, custom, onChange, onReset }: { ui: Tokens; label: string; value: string; custom: boolean; onChange: (v: string) => void; onReset: () => void }) {
  return (
    <div className="grid gap-1.5">
      <span className={ui.label}>{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-transparent bg-transparent p-0" />
        <code className={`text-[11px] ${ui.sub}`}>{value}</code>
        {custom && <button type="button" onClick={onReset} className={`ml-auto text-[11px] font-semibold underline ${ui.accent}`}>Use brand</button>}
      </div>
    </div>
  );
}

function Toggle({ ui, label, checked, onChange, disabled }: { ui: Tokens; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2 text-xs ${disabled ? "opacity-50" : ""} ${ui.label}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-orange-500" />
      {label}
    </label>
  );
}

export type GalleryImage = { url: string; label: string };

function ImagePicker({ ui, label, value, onChange, hint, gallery }: { ui: Tokens; label: string; value: string; onChange: (v: string) => void; hint?: string; gallery?: GalleryImage[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  async function pick(file: File) {
    setBusy(true);
    setNote(null);
    try {
      onChange(await uploadImage(file));
      setNote("Image uploaded.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className="grid min-w-0 gap-1.5">
      <span className={ui.label}>{label}</span>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Paste image URL or upload" className={`${ui.input} flex-1`} />
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
        {gallery && gallery.length > 0 && (
          <button type="button" onClick={() => setShowGallery((s) => !s)} className={`${ui.btn} shrink-0`}>{showGallery ? "Hide" : "Choose image"}</button>
        )}
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className={`${ui.btn} shrink-0`}>{busy ? "Uploading…" : "Upload"}</button>
        {value && <button type="button" onClick={() => onChange("")} className={`${ui.btn} shrink-0`}>Remove</button>}
      </div>
      {(note || hint) && <span className={ui.sub}>{note ?? hint}</span>}
      {gallery && gallery.length > 0 && showGallery && (
        <div className="mt-1 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {gallery.map((g, i) => (
            <button
              key={`${g.url}-${i}`}
              type="button"
              title={g.label}
              onClick={() => { onChange(g.url); setShowGallery(false); }}
              className={`group relative aspect-square overflow-hidden rounded-lg border ${value === g.url ? "border-primary ring-2 ring-primary/40" : "border-black/10 hover:border-primary/40"}`}
            >
              <img src={g.url} alt={g.label} className="h-full w-full object-cover" />
              {value === g.url && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white"><Check className="h-2.5 w-2.5" /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Designer                                                                   */
/* -------------------------------------------------------------------------- */

export type SendStep = { label: string; node: ReactNode };

type StepId = "design" | "content" | "items" | "media" | "style" | "send";

export function EmailDesigner({
  design,
  variant = "admin",
  darkPreview = false,
  sendStep,
  previewFooter,
}: {
  design: EmailDesign;
  variant?: DesignerVariant;
  /** Admin dashboards in dark mode: tint the preview to match (never affects the sent email). */
  darkPreview?: boolean;
  /** The final step. The dashboard passes recipients + send; the standalone tool falls back to Export. */
  sendStep?: SendStep;
  previewFooter?: ReactNode;
}) {
  const ui = UI[variant];
  const { brand, meta, content, style, storeItems, curated } = design;
  const maxSections = MARKETING_LIMITS.sections;
  const maxPhotos = MARKETING_LIMITS.gallery;

  function updateSection(uid: string, patch: Partial<MarketingSection>) {
    design.setSections(design.sections.map((sec) => (sec.uid === uid ? { ...sec, ...patch } : sec)));
  }
  function moveSection(index: number, dir: -1 | 1) {
    const list = [...design.sections];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    design.setSections(list);
  }
  function addSection() {
    if (design.sections.length >= maxSections) return;
    design.setSections([...design.sections, { uid: `news-${Date.now()}`, title: "", body: "", imageUrl: "", linkLabel: "", linkUrl: "" }]);
  }
  function updatePhoto(uid: string, patch: Partial<MarketingPhoto>) {
    design.setGallery(design.gallery.map((ph) => (ph.uid === uid ? { ...ph, ...patch } : ph)));
  }
  function movePhoto(index: number, dir: -1 | 1) {
    const list = [...design.gallery];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    design.setGallery(list);
  }
  function addPhoto() {
    if (design.gallery.length >= maxPhotos) return;
    design.setGallery([...design.gallery, { uid: `newg-${Date.now()}`, url: "", caption: "", href: "" }]);
  }
  const [category, setCategory] = useState<MarketingTemplateCategory | "all">("all");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [copied, setCopied] = useState(false);
  const [stepId, setStepId] = useState<StepId>("design");
  const topRef = useRef<HTMLDivElement>(null);

  const thumbs = useMemo(
    () => curated.map((t) => ({ t, html: previewifyEmailHtml(renderMarketingEmail(t.id, brand, defaultMarketingContent(t.id, brand, storeItems), { unsubscribeUrl: "#", assetBaseUrl: "" })) })),
    [curated, brand, storeItems]
  );
  const visible = thumbs.filter(({ t }) => category === "all" || t.category === category);

  const previewHtml = useMemo(() => {
    const html = previewifyEmailHtml(design.render());
    return darkPreview ? darkenEmailPreview(html) : html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.template, brand, content, darkPreview]);

  const exportHtml = () => design.render({ unsubscribeUrl: "{{unsubscribe_url}}" });
  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(exportHtml());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  function downloadHtml() {
    const url = URL.createObjectURL(new Blob([exportHtml()], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brand.slug}-${design.template}-email.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const has = (x: (typeof meta.extras)[number]) => meta.extras.includes(x);
  const featuredIds = new Set(design.featured.map((f) => f.uid));
  const available = storeItems.map((item, i) => ({ item, uid: `src-${i}` })).filter(({ uid }) => !featuredIds.has(uid));

  // Every image BizNest already knows about for this brand -- the logo/banner
  // from the connected & scanned website, plus each storefront/catalog item's
  // picture -- offered as a pick-from-gallery instead of making the merchant
  // dig up and paste a URL by hand.
  const imageGallery = useMemo<GalleryImage[]>(() => {
    const seen = new Set<string>();
    const out: GalleryImage[] = [];
    const add = (url: string | null | undefined, label: string) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({ url, label });
    };
    add(brand.logoUrl, "Logo");
    add(brand.bannerUrl, "Website banner");
    storeItems.forEach((item) => add(item.imageUrl, item.name));

    // Built-in editorial photography gives every generated design a beautiful
    // starting point even when the connected website has no usable images yet.
    // These remain normal editable image URLs: the merchant can replace them
    // with a website image, catalog image, pasted URL, or an uploaded file.
    //
    // Stored as relative "/marketing-generated/..." paths: the renderer's
    // assetSrc() (lib/email/marketing-templates.ts) resolves these against the
    // current origin for the in-app preview and against the production asset
    // host for a real send, so the same stored value works correctly in both.
    const defaults: GalleryImage[] = [
      "restaurant-great-moments.jpg:Restaurant hero",
      "restaurant-coming-soon.jpg:Dark restaurant",
      "luxury-hotel-escape.jpg:Hotel hero",
      "luxury-getaway.jpg:Luxury getaway",
      "luxury-escape.jpg:Luxury experience",
      "weekend-getaway.jpg:Weekend offer",
      "vertical-hotel.jpg:Editorial hotel",
      "warm-welcome.jpg:Welcome",
      "hotel-welcome-newsletter.jpg:Hotel welcome",
      "luxury-hotel-newsletter.jpg:Hotel newsletter",
    ].map((entry) => {
      const [file, label] = entry.split(":");
      return { url: `/marketing-generated/${file}`, label };
    });
    defaults.forEach((item) => add(item.url, item.label));
    return out;
  }, [brand.logoUrl, brand.bannerUrl, storeItems]);
  const maxItems = MARKETING_LIMITS.items;
  const white = variant === "dark" ? "text-white" : "";

  function updateItem(uid: string, patch: Partial<MarketingItem>) {
    design.setFeatured(design.featured.map((f) => (f.uid === uid ? { ...f, ...patch } : f)));
  }
  function moveItem(index: number, dir: -1 | 1) {
    const list = [...design.featured];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    design.setFeatured(list);
  }
  function addBlank() {
    if (design.featured.length >= maxItems) return;
    design.setFeatured([...design.featured, { uid: `new-${Date.now()}`, name: "New item", description: "", price: "", imageUrl: "", href: "" }]);
  }

  /* ---- steps ---- */
  const steps: Array<{ id: StepId; label: string; warn?: boolean; count?: number }> = [
    { id: "design", label: "Design" },
    { id: "content", label: "Write", warn: design.sampleWarnings.length > 0 },
    ...(design.usesItems ? [{ id: "items" as const, label: "Products", count: design.featured.length }] : []),
    ...(design.usesSections || design.usesGallery || design.usesBanner
      ? [{ id: "media" as const, label: "Images", count: design.sections.length + design.gallery.length + (design.content.bannerImageUrl ? 1 : 0) }]
      : []),
    { id: "style", label: "Style" },
    { id: "send", label: sendStep?.label ?? "Export" },
  ];
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const current = steps[index];
  function go(i: number) {
    setStepId(steps[Math.max(0, Math.min(steps.length - 1, i))].id);
    const top = topRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const StepHeader = ({ title, sub }: { title: string; sub: string }) => (
    <div className="mb-4"><h2 className={ui.title}>{title}</h2><p className={`mt-1 ${ui.sub}`}>{sub}</p></div>
  );

  const designStep = (
    <div className={ui.card}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className={ui.title}>Choose a design</h2>
          <p className={`mt-1 ${ui.sub}`}>These designs are curated automatically from your connected website's business type and catalog. No AI is used to choose them.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${variant === "dark" ? "bg-emerald-500/10 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>Website-matched</span>
            {brand.businessType && <span className={ui.badge}>{brand.businessType}</span>}
            <span className={ui.sub}>Brand colours, logo and website items are already applied.</span>
          </div>
        </div>
        <Sparkles className={`h-5 w-5 shrink-0 ${ui.accent}`} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Design categories">
        {MARKETING_CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={category === c.id} onClick={() => setCategory(c.id)} className={category === c.id ? ui.chipOn : ui.chip}>{c.label}</button>
        ))}
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))]">
        {visible.map(({ t, html }) => {
          const on = design.template === t.id;
          return (
            <button key={t.id} type="button" aria-pressed={on} onClick={() => design.setTemplate(t.id)} className={on ? ui.tileOn : ui.tile}>
              <div className={`relative mx-auto h-44 w-[176px] overflow-hidden rounded-lg border border-black/5 ${ui.thumbBg}`}>
                <iframe title={`${t.name} preview`} srcDoc={html} sandbox="" loading="lazy" tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 border-0" style={{ width: 640, height: 900, transform: "scale(0.275)", transformOrigin: "top left" }} />
                {on && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"><Check className="h-3 w-3" /></span>}
              </div>
              <div className="mt-2 flex items-start justify-between gap-2">
                <p className={`text-sm font-semibold ${white}`}>{t.name}</p>
                {t === curated[0] && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${variant === "dark" ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>Recommended</span>}
              </div>
              <p className={`mt-0.5 text-[11px] leading-4 ${ui.sub}`}>{t.description}</p>
              {t === curated.find((x) => x.id === t.id) && (t as typeof curated[number]).reason && <p className={`mt-1 text-[10px] leading-4 ${variant === "dark" ? "text-emerald-300/80" : "text-emerald-700/80"}`}>{(t as typeof curated[number]).reason}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );

  const contentStep = (
    <div className="space-y-5">
      {design.sampleWarnings.length > 0 && (
        <div role="status" className={`rounded-xl border p-3 text-xs ${ui.warn} ${white}`}>
          <p className="font-semibold">Replace the sample {design.sampleWarnings.join(", ")} below before you send.</p>
        </div>
      )}
      <div className={ui.card}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Type className={`h-4 w-4 ${ui.accent}`} /><h2 className={ui.title}>Write your email</h2></div>
          {design.isEdited && <button type="button" onClick={design.reset} className={ui.btn}><RotateCcw className="h-3.5 w-3.5" />Reset to defaults</button>}
        </div>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field ui={ui} label="Email subject" value={design.subject} onChange={(v) => design.setText("subject", v)} placeholder="Your subject line" max={MARKETING_LIMITS.subject} />
            <Field ui={ui} label="Preview text" value={design.text("previewText")} onChange={(v) => design.setText("previewText", v)} placeholder="Shown beside the subject" max={MARKETING_LIMITS.previewText} />
          </div>
          <div className={`${ui.divider}`} />
          <Field ui={ui} label={meta.labels?.eyebrow ?? "Small label above the headline"} value={design.text("eyebrow")} onChange={(v) => design.setText("eyebrow", v)} max={MARKETING_LIMITS.eyebrow} />
          <Field ui={ui} label="Headline" value={design.text("headline")} onChange={(v) => design.setText("headline", v)} max={MARKETING_LIMITS.headline} />
          <Area ui={ui} label="Message" value={design.text("body")} onChange={(v) => design.setText("body", v)} rows={6} max={MARKETING_LIMITS.body} hint="Leave a blank line to start a new paragraph." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field ui={ui} label="Button label" value={design.text("ctaLabel")} onChange={(v) => design.setText("ctaLabel", v)} max={MARKETING_LIMITS.ctaLabel} />
            <Field ui={ui} label="Button link" value={design.text("ctaUrl")} onChange={(v) => design.setText("ctaUrl", v)} placeholder="https://" max={MARKETING_LIMITS.ctaUrl} />
          </div>
          {has("secondaryCta") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field ui={ui} label="Second link label (optional)" value={design.text("secondaryCtaLabel")} onChange={(v) => design.setText("secondaryCtaLabel", v)} max={MARKETING_LIMITS.secondaryCtaLabel} />
              <Field ui={ui} label="Second link URL" value={design.text("secondaryCtaUrl")} onChange={(v) => design.setText("secondaryCtaUrl", v)} placeholder="https://" max={MARKETING_LIMITS.secondaryCtaUrl} />
            </div>
          )}
          <div className={`${ui.divider}`} />
          <ImagePicker ui={ui} label={meta.labels?.image ?? "Header / cover image"} value={design.text("imageUrl")} onChange={(v) => design.setText("imageUrl", v)} hint="A beautiful default image is supplied. Replace it with a website image, catalog image, uploaded photo, or any image URL." gallery={imageGallery} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Area ui={ui} label="Sign-off (optional)" value={design.text("signature")} onChange={(v) => design.setText("signature", v)} rows={2} max={MARKETING_LIMITS.signature} placeholder={"Warmly,\nThe team"} />
            <Area ui={ui} label="P.S. note (optional)" value={design.text("closingNote")} onChange={(v) => design.setText("closingNote", v)} rows={2} max={MARKETING_LIMITS.closingNote} placeholder="A last reminder or small print" />
          </div>
        </div>
      </div>

      {has("offer") && (
        <div className={ui.card}>
          <StepHeader title="Offer & discount code" sub="Leave a field empty to hide it in the email." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field ui={ui} label={meta.labels?.offerLabel ?? "Offer (e.g. 20% off)"} value={design.text("offerLabel")} onChange={(v) => design.setText("offerLabel", v)} max={MARKETING_LIMITS.offerLabel} />
            <Field ui={ui} label={meta.labels?.couponCode ?? "Discount code"} value={design.text("couponCode")} onChange={(v) => design.setText("couponCode", v.toUpperCase().replace(/\s+/g, ""))} max={MARKETING_LIMITS.couponCode} placeholder="e.g. WELCOME10" />
            <div className="sm:col-span-2"><Field ui={ui} label={meta.labels?.offerNote ?? "Terms or deadline"} value={design.text("offerNote")} onChange={(v) => design.setText("offerNote", v)} max={MARKETING_LIMITS.offerNote} placeholder="e.g. Ends Sunday. One use per customer." /></div>
          </div>
        </div>
      )}
      {has("event") && (
        <div className={ui.card}>
          <StepHeader title="Event details" sub="Shown as a date, time and place block." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field ui={ui} label="Date" value={design.text("eventDate")} onChange={(v) => design.setText("eventDate", v)} max={MARKETING_LIMITS.eventDate} />
            <Field ui={ui} label="Time" value={design.text("eventTime")} onChange={(v) => design.setText("eventTime", v)} max={MARKETING_LIMITS.eventTime} />
            <div className="sm:col-span-2"><Field ui={ui} label="Location" value={design.text("eventLocation")} onChange={(v) => design.setText("eventLocation", v)} max={MARKETING_LIMITS.eventLocation} /></div>
          </div>
        </div>
      )}
      {has("highlights") && (
        <div className={ui.card}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h2 className={ui.title}>{meta.labels?.highlights ?? "Highlights"}</h2><p className={`mt-1 ${ui.sub}`}>Short lines shown as a list. Up to {MARKETING_LIMITS.highlights}.</p></div>
            <button type="button" disabled={design.highlights.length >= MARKETING_LIMITS.highlights} onClick={() => design.setHighlights([...design.highlights, ""])} className={ui.btn}><Plus className="h-3.5 w-3.5" />Add line</button>
          </div>
          <div className="space-y-2">
            {design.highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <input aria-label={`Highlight ${i + 1}`} value={h} maxLength={MARKETING_LIMITS.highlight} onChange={(e) => design.setHighlights(design.highlights.map((x, j) => (j === i ? e.target.value : x)))} className={ui.input} />
                <button type="button" aria-label="Remove line" onClick={() => design.setHighlights(design.highlights.filter((_, j) => j !== i))} className={ui.btn}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {!design.highlights.length && <p className={`rounded-lg border border-dashed p-4 text-center ${ui.sub}`}>No lines yet. Add one to show a list.</p>}
          </div>
        </div>
      )}
    </div>
  );

  const itemsStep = (
    <div className={ui.card}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h2 className={ui.title}>Featured products &amp; services</h2><p className={`mt-1 ${ui.sub}`}>Pull items from your storefront or write your own. Up to {maxItems}.</p></div>
        <ImageIcon className={`h-4 w-4 shrink-0 ${ui.accent}`} />
      </div>
      <div className="space-y-3">
        {design.featured.map((f, i) => (
          <details key={f.uid} className={ui.nested} open={f.uid.startsWith("new-")}>
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/10">{f.imageUrl ? <img src={f.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</span>
              <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-semibold ${white}`}>{f.name || "Untitled item"}</span><span className={`block truncate ${ui.sub}`}>{f.price || "No price"}</span></span>
              <span className="flex shrink-0 gap-1" onClick={(e) => e.preventDefault()}>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveItem(i, -1)} className={ui.btn}><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Move down" disabled={i === design.featured.length - 1} onClick={() => moveItem(i, 1)} className={ui.btn}><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Remove item" onClick={() => design.setFeatured(design.featured.filter((x) => x.uid !== f.uid))} className={ui.btn}><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            </summary>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                <Field ui={ui} label="Name" value={f.name} max={MARKETING_LIMITS.itemName} onChange={(v) => updateItem(f.uid, { name: v })} />
                <Field ui={ui} label="Price" value={f.price ?? ""} max={MARKETING_LIMITS.itemPrice} onChange={(v) => updateItem(f.uid, { price: v })} placeholder="NGN 5,000" />
              </div>
              <Area ui={ui} label="Description" value={f.description ?? ""} rows={2} max={MARKETING_LIMITS.itemDescription} onChange={(v) => updateItem(f.uid, { description: v })} />
              <ImagePicker ui={ui} label="Picture" value={f.imageUrl ?? ""} onChange={(v) => updateItem(f.uid, { imageUrl: v })} gallery={imageGallery} />
              <Field ui={ui} label="Link (optional)" value={f.href ?? ""} max={MARKETING_LIMITS.itemUrl} onChange={(v) => updateItem(f.uid, { href: v })} placeholder="Opens your storefront if left empty" />
            </div>
          </details>
        ))}
        {!design.featured.length && <p className={`rounded-lg border border-dashed p-5 text-center ${ui.sub}`}>No items selected. Add some below, or turn off &ldquo;Show featured items&rdquo; in Style.</p>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={addBlank} disabled={design.featured.length >= maxItems} className={ui.btn}><Plus className="h-3.5 w-3.5" />Add custom item</button>
        {available.length > 0 && <span className={ui.sub}>or add from your storefront:</span>}
      </div>
      {available.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {available.map(({ item, uid }) => (
            <button key={uid} type="button" disabled={design.featured.length >= maxItems} onClick={() => design.setFeatured([...design.featured, { ...item, uid }])} className={`flex items-center gap-3 ${ui.nested} text-left hover:border-primary/40 disabled:opacity-50`}>
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/10">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</span>
              <span className="min-w-0"><span className={`block truncate text-sm font-semibold ${white}`}>{item.name}</span><span className={`block truncate ${ui.sub}`}>{item.kind === "service" ? "Service" : "Product"}{item.price ? ` · ${item.price}` : ""}</span></span>
              <Plus className={`ml-auto h-4 w-4 shrink-0 ${ui.accent}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const mediaStep = (
    <div className="space-y-5">
      {design.usesSections && (
        <div className={ui.card}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h2 className={ui.title}>Story sections</h2><p className={`mt-1 ${ui.sub}`}>Picture-and-text blocks shown one after another. Up to {maxSections}.</p></div>
            <button type="button" disabled={design.sections.length >= maxSections} onClick={addSection} className={ui.btn}><Plus className="h-3.5 w-3.5" />Add section</button>
          </div>
          <div className="space-y-3">
            {design.sections.map((sec, i) => (
              <details key={sec.uid} className={ui.nested} open={sec.uid.startsWith("news-")}>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/10">{sec.imageUrl ? <img src={sec.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</span>
                  <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-semibold ${white}`}>{sec.title || "Untitled section"}</span><span className={`block truncate ${ui.sub}`}>{sec.body || "No text yet"}</span></span>
                  <span className="flex shrink-0 gap-1" onClick={(e) => e.preventDefault()}>
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveSection(i, -1)} className={ui.btn}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Move down" disabled={i === design.sections.length - 1} onClick={() => moveSection(i, 1)} className={ui.btn}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Remove section" onClick={() => design.setSections(design.sections.filter((x) => x.uid !== sec.uid))} className={ui.btn}><Trash2 className="h-3.5 w-3.5" /></button>
                  </span>
                </summary>
                <div className="mt-4 grid gap-3">
                  <Field ui={ui} label="Title" value={sec.title} max={MARKETING_LIMITS.sectionTitle} onChange={(v) => updateSection(sec.uid, { title: v })} />
                  <Area ui={ui} label="Text (optional)" value={sec.body ?? ""} rows={2} max={MARKETING_LIMITS.sectionBody} onChange={(v) => updateSection(sec.uid, { body: v })} />
                  <ImagePicker ui={ui} label="Picture" value={sec.imageUrl ?? ""} onChange={(v) => updateSection(sec.uid, { imageUrl: v })} gallery={imageGallery} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field ui={ui} label="Link label (optional)" value={sec.linkLabel ?? ""} max={MARKETING_LIMITS.sectionLabel} onChange={(v) => updateSection(sec.uid, { linkLabel: v })} />
                    <Field ui={ui} label="Link URL" value={sec.linkUrl ?? ""} max={MARKETING_LIMITS.itemUrl} onChange={(v) => updateSection(sec.uid, { linkUrl: v })} placeholder="https://" />
                  </div>
                </div>
              </details>
            ))}
            {!design.sections.length && <p className={`rounded-lg border border-dashed p-5 text-center ${ui.sub}`}>No story sections yet. Add one to tell a longer story with its own picture.</p>}
          </div>
        </div>
      )}

      {design.usesGallery && (
        <div className={ui.card}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h2 className={ui.title}>Photo gallery</h2><p className={`mt-1 ${ui.sub}`}>A grid of extra pictures. Up to {maxPhotos}.</p></div>
            <button type="button" disabled={design.gallery.length >= maxPhotos} onClick={addPhoto} className={ui.btn}><Plus className="h-3.5 w-3.5" />Add photo</button>
          </div>
          <Field ui={ui} label="Gallery title (optional)" value={design.text("galleryTitle")} onChange={(v) => design.setText("galleryTitle", v)} max={MARKETING_LIMITS.galleryTitle} placeholder="Photo highlights" />
          <div className="mt-3 space-y-3">
            {design.gallery.map((ph, i) => (
              <details key={ph.uid} className={ui.nested} open={ph.uid.startsWith("newg-")}>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/10">{ph.url ? <img src={ph.url} alt="" className="h-full w-full object-cover" /> : null}</span>
                  <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-semibold ${white}`}>{ph.caption || `Photo ${i + 1}`}</span></span>
                  <span className="flex shrink-0 gap-1" onClick={(e) => e.preventDefault()}>
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => movePhoto(i, -1)} className={ui.btn}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Move down" disabled={i === design.gallery.length - 1} onClick={() => movePhoto(i, 1)} className={ui.btn}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Remove photo" onClick={() => design.setGallery(design.gallery.filter((x) => x.uid !== ph.uid))} className={ui.btn}><Trash2 className="h-3.5 w-3.5" /></button>
                  </span>
                </summary>
                <div className="mt-4 grid gap-3">
                  <ImagePicker ui={ui} label="Picture" value={ph.url} onChange={(v) => updatePhoto(ph.uid, { url: v })} gallery={imageGallery} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field ui={ui} label="Caption (optional)" value={ph.caption ?? ""} max={MARKETING_LIMITS.photoCaption} onChange={(v) => updatePhoto(ph.uid, { caption: v })} />
                    <Field ui={ui} label="Link (optional)" value={ph.href ?? ""} max={MARKETING_LIMITS.itemUrl} onChange={(v) => updatePhoto(ph.uid, { href: v })} placeholder="https://" />
                  </div>
                </div>
              </details>
            ))}
            {!design.gallery.length && <p className={`rounded-lg border border-dashed p-5 text-center ${ui.sub}`}>No photos yet. Add a few to fill out a gallery grid.</p>}
          </div>
        </div>
      )}

      {design.usesBanner && (
        <div className={ui.card}>
          <StepHeader title="Promo banner" sub="One wide picture, shown once near the end of the email." />
          <div className="grid gap-3">
            <ImagePicker ui={ui} label="Banner image" value={design.text("bannerImageUrl")} onChange={(v) => design.setText("bannerImageUrl", v)} gallery={imageGallery} />
            <Field ui={ui} label="Banner link (optional)" value={design.text("bannerLinkUrl")} onChange={(v) => design.setText("bannerLinkUrl", v)} placeholder="https://" max={MARKETING_LIMITS.bannerLinkUrl} />
          </div>
        </div>
      )}
    </div>
  );

  const styleStep = (
    <div className={ui.card}>
      <div className="mb-1 flex items-center gap-2"><Palette className={`h-4 w-4 ${ui.accent}`} /><h2 className={ui.title}>Look &amp; feel</h2></div>
      <p className={`mb-4 ${ui.sub}`}>Starts with your brand. Changes here apply to this email only.</p>
      <p className={`mb-2 text-xs font-semibold ${white}`}>Colours</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ColorField ui={ui} label="Brand colour" value={hex6(style.primary ?? brand.primary, "#111827")} custom={!!style.primary} onChange={(v) => design.patchStyle({ primary: v })} onReset={() => design.patchStyle({ primary: undefined })} />
        <ColorField ui={ui} label="Button colour" value={hex6(style.button ?? style.primary ?? brand.primary, "#111827")} custom={!!style.button} onChange={(v) => design.patchStyle({ button: v })} onReset={() => design.patchStyle({ button: undefined })} />
        <ColorField ui={ui} label="Page background" value={hex6(style.background ?? brand.background, "#f3f4f6")} custom={!!style.background} onChange={(v) => design.patchStyle({ background: v })} onReset={() => design.patchStyle({ background: undefined })} />
        <ColorField ui={ui} label="Text colour" value={hex6(style.text ?? brand.text, "#111827")} custom={!!style.text} onChange={(v) => design.patchStyle({ text: v })} onReset={() => design.patchStyle({ text: undefined })} />
      </div>
      <div className={`my-5 ${ui.divider}`} />
      <p className={`mb-2 text-xs font-semibold ${white}`}>Type &amp; layout</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={ui.label}>Font</span>
          <select value={style.font ?? ""} onChange={(e) => design.patchStyle({ font: (e.target.value || undefined) as MarketingStyle["font"] })} className={ui.input}>
            <option value="">Design default</option>
            {MARKETING_FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <Segmented ui={ui} label="Text alignment" value={style.align ?? meta.align} onChange={(v) => design.patchStyle({ align: v })} options={[{ id: "left", label: "Left" }, { id: "center", label: "Centred" }]} />
        <Segmented ui={ui} label="Button shape" value={style.buttonShape ?? "rounded"} onChange={(v) => design.patchStyle({ buttonShape: v })} options={[{ id: "rounded", label: "Rounded" }, { id: "pill", label: "Pill" }, { id: "square", label: "Square" }]} />
      </div>
      <div className={`my-5 ${ui.divider}`} />
      <p className={`mb-2 text-xs font-semibold ${white}`}>Show or hide</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle ui={ui} label="Logo header" checked={style.showLogo !== false && design.template !== "newsletter"} disabled={design.template === "newsletter"} onChange={(v) => design.patchStyle({ showLogo: v })} />
        <Toggle ui={ui} label="Main image" checked={style.showImage !== false} onChange={(v) => design.patchStyle({ showImage: v })} />
        {design.usesItems && <Toggle ui={ui} label="Featured items" checked={style.showItems !== false} onChange={(v) => design.patchStyle({ showItems: v })} />}
        <Toggle ui={ui} label="Contact & social links in footer" checked={style.showFooterDetails !== false} onChange={(v) => design.patchStyle({ showFooterDetails: v })} />
      </div>
      <p className={`mt-4 ${ui.sub}`}>The unsubscribe link is always included.</p>
    </div>
  );

  const exportStep = (
    <div className={ui.card}>
      <StepHeader title="Export your email" sub="Copy or download the finished HTML to use in your own sending tool." />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copyHtml} className={ui.primary}><Copy className="h-4 w-4" />{copied ? "Copied" : "Copy HTML"}</button>
        <button type="button" onClick={downloadHtml} className={ui.btn}><Download className="h-3.5 w-3.5" />Download .html</button>
      </div>
      <p className={`mt-3 ${ui.sub}`}>The export keeps a {"{{unsubscribe_url}}"} placeholder for your sending tool to fill in.</p>
    </div>
  );

  const stepBody: Record<StepId, ReactNode> = { design: designStep, content: contentStep, items: itemsStep, media: mediaStep, style: styleStep, send: sendStep?.node ?? exportStep };

  return (
    <div className="min-w-0">
      {/* Small screens: switch between editing and previewing */}
      <div className={`mb-4 xl:hidden ${ui.seg}`} role="group" aria-label="Editor or preview">
        <button type="button" aria-pressed={pane === "edit"} onClick={() => setPane("edit")} className={`flex-1 px-4 py-2 ${pane === "edit" ? ui.segOn : ui.segOff}`}>Edit</button>
        <button type="button" aria-pressed={pane === "preview"} onClick={() => setPane("preview")} className={`flex-1 px-4 py-2 ${pane === "preview" ? ui.segOn : ui.segOff}`}>Preview</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,520px)]">
        <section ref={topRef} className={`min-w-0 space-y-5 ${pane === "preview" ? "hidden xl:block" : ""}`}>
          <nav aria-label="Email steps">
            <ol className="flex flex-wrap gap-2">
              {steps.map((s, i) => {
                const on = s.id === current.id;
                return (
                  <li key={s.id}>
                    <button type="button" aria-current={on ? "step" : undefined} onClick={() => go(i)} className={on ? ui.stepOn : ui.step}>
                      <span className={on ? ui.numOn : ui.num}>{i < index ? <Check className="h-3 w-3" /> : i + 1}</span>
                      {s.label}
                      {s.count !== undefined && <span className={`text-[11px] font-normal ${ui.sub}`}>{s.count}</span>}
                      {s.warn && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Needs attention" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {stepBody[current.id]}

          <div className="flex items-center justify-between gap-3">
            <button type="button" disabled={index === 0} onClick={() => go(index - 1)} className={ui.btn}>Back</button>
            {index < steps.length - 1 && <button type="button" onClick={() => go(index + 1)} className={ui.primary}>Next: {steps[index + 1].label}</button>}
          </div>
        </section>

        {/* Preview */}
        <aside className={`min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto ${pane === "edit" ? "hidden xl:block" : ""}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><p className={ui.title}>Live preview</p><p className={ui.sub}>Updates as you type.</p></div>
            <div className={ui.seg} role="group" aria-label="Preview size">
              <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 ${device === "desktop" ? ui.segOn : ui.segOff}`}><Monitor className="h-3.5 w-3.5" />Desktop</button>
              <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 ${device === "mobile" ? ui.segOn : ui.segOff}`}><Smartphone className="h-3.5 w-3.5" />Mobile</button>
            </div>
          </div>
          <div className={`mb-3 overflow-hidden rounded-2xl border ${variant === "dark" ? "border-slate-700 bg-slate-900" : "bg-background"} shadow-sm`}>
            <div className={`px-4 py-3 ${variant === "dark" ? "bg-slate-800/60" : "bg-muted/40"}`}>
              <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${ui.sub}`}>Inbox preview</p>
              <div className="flex gap-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${variant === "dark" ? "bg-orange-500/15 text-orange-300" : "bg-[hsl(var(--primary)/0.1)] text-primary"}`}>{brand.name.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2"><p className={`truncate text-sm font-semibold ${white}`}>{brand.name}</p><p className={`ml-auto shrink-0 text-[10px] ${ui.sub}`}>Now</p></div>
                  <p className={`truncate text-sm font-medium ${variant === "dark" ? "text-slate-100" : ""}`}>{design.subject || "Your subject line"}</p>
                  <p className={`truncate ${ui.sub}`}>{design.text("previewText") || "The small line shown beside the subject"}</p>
                </div>
              </div>
            </div>
          </div>
          <div className={ui.frameWrap}>
            <iframe title="Email preview" srcDoc={previewHtml} sandbox="" className={`mx-auto h-[720px] rounded-xl ${ui.frameBg} ${device === "mobile" ? "w-[390px] max-w-full" : "w-full"}`} />
          </div>
          {sendStep && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={copyHtml} className={ui.btn}><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy HTML"}</button>
              <button type="button" onClick={downloadHtml} className={ui.btn}><Download className="h-3.5 w-3.5" />Download .html</button>
            </div>
          )}
          {previewFooter}
        </aside>
      </div>
    </div>
  );
}