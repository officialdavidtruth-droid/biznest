"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  updateHeroOverrides, updateHeroImage, updateStoryOverrides, updateStoryImage,
  type HeroOverrides, type StoryOverrides,
} from "@/lib/actions/store";
import type { TemplateTheme } from "@/lib/template-themes";
import { FileUploadField } from "@/components/forms/file-upload-field";

/**
 * Narrow-column ("380px sidebar") version of the hero/story content editing
 * that used to live on its own full-width /website-editor page. Same
 * fields, same server actions — just laid out as two collapsible blocks so
 * it fits inside the unified builder's left panel next to Sections &
 * Layout, with the live iframe on the right updating on every save instead
 * of needing its own page navigation.
 */
export function ContentPanel({
  slug,
  storeName,
  theme,
  heroImage,
  heroOverrides,
  storyImage,
  storyOverrides,
  storyDescription,
  onSaved,
}: {
  slug: string;
  storeName: string;
  theme: TemplateTheme;
  heroImage: string | null;
  heroOverrides: HeroOverrides;
  storyImage: string | null;
  storyOverrides: StoryOverrides;
  storyDescription: string | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState<"hero" | "story" | null>("hero");

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Edit the text and images shown on your homepage. Changes publish immediately and update the
        preview on the right.
      </p>

      <BlockGroup title="Hero" open={open === "hero"} onToggle={() => setOpen(open === "hero" ? null : "hero")}>
        <HeroFields slug={slug} storeName={storeName} theme={theme} heroImage={heroImage} initial={heroOverrides} onSaved={onSaved} />
      </BlockGroup>

      {storyDescription && (
        <BlockGroup title="About / Story" open={open === "story"} onToggle={() => setOpen(open === "story" ? null : "story")}>
          <StoryFields
            slug={slug}
            storeName={storeName}
            description={storyDescription}
            storyImage={storyImage}
            theme={theme}
            initial={storyOverrides}
            onSaved={onSaved}
          />
        </BlockGroup>
      )}
    </div>
  );
}

function BlockGroup({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="mb-2 rounded-md border border-border">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium hover:bg-muted"
      >
        {title}
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange, onSave, isSaving, multiline }: {
  label: string; value: string; onChange: (v: string) => void; onSave: () => void; isSaving: boolean; multiline?: boolean;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-1.5">
        {multiline ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded-md border px-2.5 py-1.5 text-sm" />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border px-2.5 py-1.5 text-sm" />
        )}
        <button
          onClick={onSave}
          disabled={isSaving}
          className="shrink-0 self-start rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function HeroFields({ slug, storeName, theme, heroImage, initial, onSaved }: {
  slug: string; storeName: string; theme: TemplateTheme; heroImage: string | null; initial: HeroOverrides; onSaved: () => void;
}) {
  const [headline, setHeadline] = useState(initial.headline || storeName);
  const [subtitle, setSubtitle] = useState(initial.subtitle || theme.sub);
  const [ctaLabel, setCtaLabel] = useState(initial.ctaLabel || theme.cta);
  const [image, setImage] = useState(heroImage || "");
  const [isSaving, setIsSaving] = useState(false);

  async function saveField(field: keyof HeroOverrides, value: string) {
    setIsSaving(true);
    const result = await updateHeroOverrides(slug, { [field]: value });
    setIsSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Hero updated");
    onSaved();
  }

  async function saveImage(value: string) {
    setIsSaving(true);
    const result = await updateHeroImage(slug, value);
    setIsSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Hero image updated");
    onSaved();
  }

  return (
    <div>
      <Field label="Headline" value={headline} onChange={setHeadline} onSave={() => saveField("headline", headline)} isSaving={isSaving} />
      <Field label="Subtitle" value={subtitle} onChange={setSubtitle} onSave={() => saveField("subtitle", subtitle)} isSaving={isSaving} multiline />
      <Field label="Button label" value={ctaLabel} onChange={setCtaLabel} onSave={() => saveField("ctaLabel", ctaLabel)} isSaving={isSaving} />
      <div className="mb-1 mt-1 text-xs font-medium text-muted-foreground">Background image</div>
      <FileUploadField label="" value={image} onChange={(url) => { setImage(url); saveImage(url); }} />
    </div>
  );
}

function StoryFields({ slug, storeName, description, storyImage, theme, initial, onSaved }: {
  slug: string; storeName: string; description: string; storyImage: string | null; theme: TemplateTheme; initial: StoryOverrides; onSaved: () => void;
}) {
  const [eyebrow, setEyebrow] = useState(initial.eyebrow || "What we do");
  const [heading, setHeading] = useState(initial.heading || `Behind the ${storeName} story.`);
  const [body, setBody] = useState(initial.body || description);
  const [image, setImage] = useState(storyImage || "");
  const [isSaving, setIsSaving] = useState(false);

  async function saveField(field: keyof StoryOverrides, value: string) {
    setIsSaving(true);
    const result = await updateStoryOverrides(slug, { [field]: value });
    setIsSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Story updated");
    onSaved();
  }

  async function saveImage(value: string) {
    setIsSaving(true);
    const result = await updateStoryImage(slug, value);
    setIsSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Story image updated");
    onSaved();
  }

  return (
    <div>
      <Field label="Eyebrow" value={eyebrow} onChange={setEyebrow} onSave={() => saveField("eyebrow", eyebrow)} isSaving={isSaving} />
      <Field label="Heading" value={heading} onChange={setHeading} onSave={() => saveField("heading", heading)} isSaving={isSaving} />
      <Field label="Body" value={body} onChange={setBody} onSave={() => saveField("body", body)} isSaving={isSaving} multiline />
      <div className="mb-1 mt-1 text-xs font-medium text-muted-foreground">Image</div>
      <FileUploadField label="" value={image} onChange={(url) => { setImage(url); saveImage(url); }} />
    </div>
  );
}
