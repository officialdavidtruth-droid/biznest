"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateStoryOverrides, updateStoryImage, type StoryOverrides } from "@/lib/actions/store";
import { FRESH, type TemplateTheme } from "@/lib/template-themes";

type BlockId = "eyebrow" | "heading" | "body" | "image" | null;

/**
 * Click-to-edit surface for the "story" (About) block, right below the hero
 * on the storefront — same canvas + per-block panel pattern as
 * hero-block-editor.tsx. Kept as a separate component (rather than one
 * mega-editor) so each section's canvas markup can diverge without one
 * component accumulating every section's layout logic.
 */
export function StoryBlockEditor({
  slug,
  storeName,
  description,
  storyImage,
  initial,
}: {
  slug: string;
  storeName: string;
  description: string;
  // The image actually shown for this block (storyImage override, falling
  // back to bannerUrl/template preview) -- resolved by the parent page.
  storyImage: string | null;
  initial: StoryOverrides;
}) {
  const [eyebrowText, setEyebrowText] = useState(initial.eyebrow || "What we do");
  const [heading, setHeading] = useState(initial.heading || `Behind the ${storeName} story.`);
  const [body, setBody] = useState(initial.body || description);
  const [image, setImage] = useState(storyImage || "");
  const [selected, setSelected] = useState<BlockId>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveBlock(field: keyof StoryOverrides, value: string) {
    setIsSaving(true);
    const result = await updateStoryOverrides(slug, { [field]: value });
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Block updated");
  }

  async function saveImage(value: string) {
    setIsSaving(true);
    const result = await updateStoryImage(slug, value);
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Image updated");
  }

  function outline(id: BlockId) {
    return selected === id
      ? { outline: `2px solid ${FRESH.leaf}`, outlineOffset: 4, borderRadius: 6, cursor: "pointer" }
      : { outline: "2px solid transparent", outlineOffset: 4, borderRadius: 6, cursor: "pointer" };
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* ---------- CANVAS ---------- */}
      <div className="overflow-hidden rounded-lg border" style={{ background: FRESH.forest }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr" }}>
          <div style={{ padding: "44px 40px", color: "#fff" }}>
            <div
              onClick={() => setSelected("eyebrow")}
              style={{ ...outline("eyebrow"), display: "inline-block", fontFamily: "monospace", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: FRESH.citrus, fontWeight: 600, padding: 4 }}
            >
              {eyebrowText}
            </div>
            <h2
              onClick={() => setSelected("heading")}
              style={{ ...outline("heading"), fontFamily: FRESH.headlineFont, fontWeight: 700, fontSize: "clamp(22px,2.8vw,32px)", lineHeight: 1.2, margin: "12px 0 0", padding: 4 }}
            >
              {heading}
            </h2>
            <p
              onClick={() => setSelected("body")}
              style={{ ...outline("body"), marginTop: 14, color: "rgba(255,255,255,.7)", fontSize: 14.5, lineHeight: 1.7, maxWidth: 420, padding: 4 }}
            >
              {body}
            </p>
          </div>
          <div
            onClick={() => setSelected("image")}
            style={{
              ...outline("image"),
              minHeight: 220,
              background: image ? `url(${image}) center/cover` : `linear-gradient(160deg,#1c4a32,#0a1f15)`,
            }}
          />
        </div>
        <p className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Click the label, heading, paragraph, or image above to edit it.
        </p>
      </div>

      {/* ---------- BLOCK PANEL ---------- */}
      <div className="rounded-lg border bg-background p-4">
        {!selected ? (
          <p className="text-sm text-muted-foreground">Select a block on the left to edit its content.</p>
        ) : selected === "image" ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Section image</p>
              <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">Paste an image URL for this section. Independent from your hero banner.</p>
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://…"
              className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => saveImage(image)}
              disabled={isSaving}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : selected === "eyebrow" ? (
          <BlockPanel
            label="Label block"
            hint="Small tag above the heading."
            value={eyebrowText}
            onChange={setEyebrowText}
            onSave={() => saveBlock("eyebrow", eyebrowText)}
            onClose={() => setSelected(null)}
            isSaving={isSaving}
            multiline={false}
          />
        ) : selected === "heading" ? (
          <BlockPanel
            label="Heading block"
            hint="Main title for this section."
            value={heading}
            onChange={setHeading}
            onSave={() => saveBlock("heading", heading)}
            onClose={() => setSelected(null)}
            isSaving={isSaving}
            multiline={false}
          />
        ) : (
          <BlockPanel
            label="Body text block"
            hint="Independent from your Settings → About description, once edited here."
            value={body}
            onChange={setBody}
            onSave={() => saveBlock("body", body)}
            onClose={() => setSelected(null)}
            isSaving={isSaving}
            multiline
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
