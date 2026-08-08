"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateHeroOverrides, type HeroOverrides } from "@/lib/actions/store";
import { FRESH, type TemplateTheme } from "@/lib/template-themes";

type BlockId = "headline" | "subtitle" | "cta" | null;

/**
 * A WordPress-style click-to-edit surface for the storefront hero: click a
 * piece of the actual rendered hero, a "Block" panel opens on the right for
 * just that piece, save writes only that field. Proof-of-concept for one
 * section — same pattern (canvas + per-block panel) can extend to other
 * sections later instead of the current all-fields-in-one-form Settings page.
 */
export function HeroBlockEditor({
  slug,
  storeName,
  theme,
  heroImage,
  initial,
}: {
  slug: string;
  storeName: string;
  theme: TemplateTheme;
  heroImage: string | null;
  initial: HeroOverrides;
}) {
  const [headline, setHeadline] = useState(initial.headline || storeName);
  const [subtitle, setSubtitle] = useState(initial.subtitle || theme.sub);
  const [ctaLabel, setCtaLabel] = useState(initial.ctaLabel || theme.cta);
  const [selected, setSelected] = useState<BlockId>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveBlock(field: keyof HeroOverrides, value: string) {
    setIsSaving(true);
    const result = await updateHeroOverrides(slug, { [field]: value });
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Block updated");
  }

  function outline(id: BlockId) {
    return selected === id
      ? { outline: `2px solid ${FRESH.leaf}`, outlineOffset: 4, borderRadius: 6, cursor: "pointer" }
      : { outline: "2px solid transparent", outlineOffset: 4, borderRadius: 6, cursor: "pointer" };
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* ---------- CANVAS ---------- */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <div
          style={{
            position: "relative",
            minHeight: 380,
            display: "flex",
            alignItems: "center",
            background: heroImage
              ? `linear-gradient(100deg, rgba(10,30,18,.82) 0%, rgba(10,30,18,.58) 38%, rgba(10,30,18,.12) 62%), url(${heroImage}) center/cover`
              : `linear-gradient(200deg,#5fc98a 0%, #2c8a52 45%, #1c5c37 100%)`,
          }}
        >
          <div style={{ position: "relative", zIndex: 2, padding: "48px 44px", maxWidth: 560 }}>
            <h1
              onClick={() => setSelected("headline")}
              style={{ ...outline("headline"), color: "#fff", fontFamily: theme.headlineFont, fontWeight: 700, fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.14, margin: 0, padding: 4 }}
            >
              {headline}
            </h1>
            <p
              onClick={() => setSelected("subtitle")}
              style={{ ...outline("subtitle"), marginTop: 16, color: "rgba(255,255,255,.85)", fontSize: 15, lineHeight: 1.6, padding: 4 }}
            >
              {subtitle}
            </p>
            <div style={{ marginTop: 24 }}>
              <span
                onClick={() => setSelected("cta")}
                style={{
                  ...outline("cta"),
                  display: "inline-block",
                  background: FRESH.citrus,
                  color: FRESH.forestDark,
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "10px 20px",
                }}
              >
                {ctaLabel}
              </span>
            </div>
          </div>
        </div>
        <p className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Click any text or the button above to edit it — just like clicking a block in the WordPress editor.
        </p>
      </div>

      {/* ---------- BLOCK PANEL ---------- */}
      <div className="rounded-lg border bg-background p-4">
        {!selected ? (
          <p className="text-sm text-muted-foreground">Select a block on the left to edit its content.</p>
        ) : selected === "headline" ? (
          <BlockPanel
            label="Headline block"
            hint="Your store name, shown large at the top of the hero."
            value={headline}
            onChange={setHeadline}
            onSave={() => saveBlock("headline", headline)}
            onClose={() => setSelected(null)}
            isSaving={isSaving}
            multiline={false}
          />
        ) : selected === "subtitle" ? (
          <BlockPanel
            label="Subtitle block"
            hint="The tagline under your store name. Independent from your Settings → About description."
            value={subtitle}
            onChange={setSubtitle}
            onSave={() => saveBlock("subtitle", subtitle)}
            onClose={() => setSelected(null)}
            isSaving={isSaving}
            multiline
          />
        ) : (
          <BlockPanel
            label="Button block"
            hint="Call-to-action label on the hero button."
            value={ctaLabel}
            onChange={setCtaLabel}
            onSave={() => saveBlock("ctaLabel", ctaLabel)}
            onClose={() => setSelected(null)}
            isSaving={isSaving}
            multiline={false}
          />
        )}
      </div>
    </div>
  );
}

function BlockPanel({
  label,
  hint,
  value,
  onChange,
  onSave,
  onClose,
  isSaving,
  multiline,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  multiline: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{hint}</p>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm"
        />
      )}
      <button
        onClick={onSave}
        disabled={isSaving}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {isSaving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
