"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  X, Monitor, Tablet, Smartphone, LayoutTemplate, Rows3, ChevronRight,
  ArrowUp, ArrowDown, RotateCw, PenSquare, FileText, Trash2, Eye, EyeOff, Plus, ChevronDown,
} from "lucide-react";
import { updateSectionOverrides } from "@/lib/actions/sections";
import { saveStorePage, toggleStorePagePublished, deleteStorePage } from "@/lib/actions/pages";
import { SUGGESTED_PAGE_SLUGS, SUGGESTED_PAGE_TITLES } from "@/lib/actions/pages-constants";
import type { Section, TemplateTheme } from "@/lib/template-themes";
import type { HeroOverrides, StoryOverrides } from "@/lib/actions/store";
import { ContentPanel } from "@/components/dashboard/content-panel";
import { saveBuilderConfig, updateStoreSeo } from "@/lib/actions/builder";
import { BUILDER_SECTION_TYPES, type BuilderConfig, type BuilderSection, type BuilderSectionType } from "@/lib/builder-config";
import { buildIndustryHomepage, getBusinessExperience } from "@/lib/business-experience";

export type StorePageRow = { id: string; slug: string; title: string; body: string; isPublished: boolean };

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };

const SECTION_LABELS: Record<Section, string> = {
  hero: "Hero",
  catalog: "Catalog (products/services)",
  about: "About",
  stats: "Stats bar (listings, rating, orders)",
  features: "Why choose us (feature grid)",
  categories: "Shop by category",
  deal: "Deal banner",
  testimonials: "Testimonials",
  newsletter: "Email signup",
  contact: "Contact",
  gallery: "Gallery",
  amenities: "Amenities",
  availability: "Availability / booking",
  map: "Map / location",
  packages: "Packages / pricing",
};

type Panel = "sections" | "content" | "design" | "seo" | "pages" | null;

/**
 * A WordPress-Customizer-style editor for a store's already-chosen template:
 * a narrow control panel on the left ("Sections & Layout" — the one thing
 * this page shapes now), a live preview of the actual storefront on the
 * right that updates after every save, and device-width toggles across the
 * top. Picking *which* template to use lives on its own page
 * (/admin/templates, see templates-page-client.tsx) — this component only
 * shows the current one, read-only, with a link to go change it there.
 */
export function CustomizerClient({
  slug,
  storeName,
  currentTemplateName,
  initialOrder,
  initialHidden,
  theme,
  heroImage,
  heroOverrides,
  storyImage,
  storyOverrides,
  storyDescription,
  pages: initialPages,
  initialBuilder,
  businessCategory,
  seoTitle,
  seoDescription,
}: {
  slug: string;
  storeName: string;
  currentTemplateName: string | null;
  initialOrder: Section[];
  initialHidden: Section[];
  theme: TemplateTheme;
  heroImage: string | null;
  heroOverrides: HeroOverrides;
  storyImage: string | null;
  storyOverrides: StoryOverrides;
  storyDescription: string | null;
  pages: StorePageRow[];
  initialBuilder: BuilderConfig;
  businessCategory: string | null;
  seoTitle: string;
  seoDescription: string;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [order, setOrder] = useState<Section[]>(initialOrder);
  const [hidden, setHidden] = useState<Set<Section>>(new Set(initialHidden));
  const [isSaving, setIsSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [pages, setPages] = useState<StorePageRow[]>(initialPages);
  const [builder, setBuilder] = useState<BuilderConfig>(initialBuilder);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(initialBuilder.sections[0]?.id ?? null);
  const [seoTitleState, setSeoTitleState] = useState(seoTitle);
  const [seoDescriptionState, setSeoDescriptionState] = useState(seoDescription);
  const experience = getBusinessExperience(businessCategory);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const builderRef = useRef<BuilderConfig>(initialBuilder);
  const previewReadyRef = useRef(false);

  const previewUrl = useMemo(() => `/store/${slug}?preview=1`, [slug]);

  function pushPreview(config: BuilderConfig = builderRef.current) {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(
      { type: "BIZNEST_CUSTOMIZER_PREVIEW", config },
      window.location.origin,
    );
  }

  useEffect(() => {
    builderRef.current = builder;
    // Keep the preview in sync on every keystroke/change. The ref avoids
    // losing the newest draft when the iframe is still loading.
    pushPreview(builder);
  }, [builder]);

  useEffect(() => {
    function handlePreviewReady(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "BIZNEST_CUSTOMIZER_PREVIEW_READY") {
        previewReadyRef.current = true;
        pushPreview(builderRef.current);
        return;
      }
      // Clicking any block in the live preview selects it here, so editing
      // stays a single click away instead of hunting for it in the section
      // list.
      if (event.data?.type === "BIZNEST_CUSTOMIZER_SELECT_SECTION" && typeof event.data.sectionId === "string") {
        setSelectedSectionId(event.data.sectionId);
        setPanel("sections");
      }
    }
    window.addEventListener("message", handlePreviewReady);
    return () => window.removeEventListener("message", handlePreviewReady);
  }, []);

  useEffect(() => {
    previewReadyRef.current = false;
    builderRef.current = builder;
  }, [previewKey]);

  function refreshPreview() {
    setPreviewKey((k) => k + 1);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 1 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function toggleHidden(s: Section) {
    const next = new Set(hidden);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setHidden(next);
  }

  async function saveSections() {
    setIsSaving(true);
    try {
      const formData = new FormData();
      for (const s of order) formData.append("order", s);
      for (const s of hidden) formData.append(`hidden-${s}`, "on");
      const result = await updateSectionOverrides(slug, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Layout published");
      refreshPreview();
    } catch {
      toast.error("Something went wrong publishing the layout. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function publishBuilder(next = builder) {
    setIsSaving(true);
    try {
      const result = await saveBuilderConfig(slug, next);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Website published");
      setBuilder(next);
      refreshPreview();
    } catch {
      toast.error("Something went wrong publishing your website. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateBuilderSection(id: string, patch: Partial<BuilderSection>) {
    setBuilder((current) => ({ ...current, sections: current.sections.map((s) => s.id === id ? { ...s, ...patch } : s) }));
  }

  function addBuilderSection(type: BuilderSectionType) {
    const id = `${type}-${Date.now()}`;
    const section: BuilderSection = { id, type, visible: true, settings: defaultSectionSettings(type) };
    setBuilder((current) => ({ ...current, sections: [...current.sections, section] }));
    setSelectedSectionId(id);
  }

  function removeBuilderSection(id: string) {
    if (id === "hero") return;
    setBuilder((current) => ({ ...current, sections: current.sections.filter((s) => s.id !== id) }));
    setSelectedSectionId("hero");
  }

  function moveBuilderSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= builder.sections.length) return;
    const next = [...builder.sections];
    [next[index], next[target]] = [next[target], next[index]];
    setBuilder((current) => ({ ...current, sections: next }));
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-muted/20">
      {/* Left control panel */}
      <div className="flex h-full w-[380px] shrink-0 flex-col border-r border-border bg-background">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link
            href={`/${slug}/admin`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Customize</p>
            <p className="truncate text-xs text-muted-foreground">{storeName}</p>
          </div>
        </div>

        {panel === null ? (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="mb-1 flex items-center justify-between rounded-md border border-border px-3 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <LayoutTemplate className="h-3.5 w-3.5" /> Template
                </p>
                <p className="mt-1 truncate text-sm font-medium">{currentTemplateName ?? "None selected"}</p>
              </div>
              <Link
                href={`/${slug}/admin/templates`}
                className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Change
              </Link>
            </div>
            <div className="mb-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">Industry homepage</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{experience.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-background px-2 py-1 text-[10px] font-medium">{experience.label}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">{experience.journey.map((step) => <span key={step} className="rounded-full border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground">{step}</span>)}</div>
              <button
                onClick={() => { const next = buildIndustryHomepage(businessCategory, storeName, storyDescription, heroImage); setBuilder(next); setSelectedSectionId(next.sections[0]?.id ?? null); setPanel("sections"); }}
                className="mt-3 w-full rounded-md border border-primary/30 bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
              >
                Use recommended homepage
              </button>
            </div>
            <div className="mb-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-3">
              <p className="text-xs font-semibold">Visual Builder</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Build the actual published homepage from sections, settings and responsive styles.</p>
              <button onClick={() => setPanel("sections")} className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Open visual builder</button>
            </div>
            <button
              onClick={() => setPanel("design")}
              className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-medium hover:bg-muted"
            >
              <span className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4" /> Design & Theme</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setPanel("seo")}
              className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-medium hover:bg-muted"
            >
              <span className="flex items-center gap-2"><Eye className="h-4 w-4" /> SEO & Social Preview</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setPanel("content")}
              className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-medium hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <PenSquare className="h-4 w-4" /> Content (text & images)
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setPanel("sections")}
              className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-medium hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <Rows3 className="h-4 w-4" /> Sections & Layout
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setPanel("pages")}
              className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-medium hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Pages
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <button
              onClick={() => setPanel(null)}
              className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Back
            </button>

            {panel === "sections" && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="mb-3 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-semibold">Section library</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Add real sections to the published homepage. Every section can be edited below.</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {BUILDER_SECTION_TYPES.map((type) => <button key={type} type="button" onClick={() => addBuilderSection(type)} className="rounded border px-2 py-1.5 text-[11px] hover:bg-background">+ {pretty(type)}</button>)}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {builder.sections.map((section, index) => (
                      <div key={section.id} className={`rounded-md border ${selectedSectionId === section.id ? "border-primary" : "border-border"}`}>
                        <button type="button" onClick={() => setSelectedSectionId(section.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{pretty(section.type)}</span>
                          {!section.visible && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                        <div className="flex items-center justify-between border-t px-2 py-1.5">
                          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" checked={section.visible} onChange={(e) => updateBuilderSection(section.id, { visible: e.target.checked })} /> Visible</label>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => moveBuilderSection(index, -1)} disabled={index === 0} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                            <button type="button" onClick={() => moveBuilderSection(index, 1)} disabled={index === builder.sections.length - 1} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                            {section.id !== "hero" && <button type="button" onClick={() => removeBuilderSection(section.id)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>}
                          </div>
                        </div>
                        {selectedSectionId === section.id && <SectionSettingsEditor section={section} onChange={(patch) => updateBuilderSection(section.id, patch)} />}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t p-3"><button onClick={() => publishBuilder()} disabled={isSaving} className="w-full rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{isSaving ? "Publishing…" : "Publish visual website"}</button></div>
              </div>
            )}

            {panel === "design" && (
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-xs text-muted-foreground">These controls change the actual published visual builder. Save them by publishing the website.</p>
                <div className="space-y-3">
                  <ColorField label="Primary" value={builder.design.primary} onChange={(v) => setBuilder((b) => ({ ...b, design: { ...b.design, primary: v } }))} />
                  <ColorField label="Accent" value={builder.design.accent} onChange={(v) => setBuilder((b) => ({ ...b, design: { ...b.design, accent: v } }))} />
                  <ColorField label="Background" value={builder.design.background} onChange={(v) => setBuilder((b) => ({ ...b, design: { ...b.design, background: v } }))} />
                  <ColorField label="Surface" value={builder.design.surface} onChange={(v) => setBuilder((b) => ({ ...b, design: { ...b.design, surface: v } }))} />
                  <ColorField label="Text" value={builder.design.text} onChange={(v) => setBuilder((b) => ({ ...b, design: { ...b.design, text: v } }))} />
                  <ColorField label="Muted text" value={builder.design.muted} onChange={(v) => setBuilder((b) => ({ ...b, design: { ...b.design, muted: v } }))} />
                  <SelectField label="Container width" value={builder.design.containerWidth} options={["compact","standard","wide"]} onChange={(v) => setBuilder((b) => ({ ...b, design: { ...b.design, containerWidth: v as BuilderConfig["design"]["containerWidth"] } }))} />
                  <SelectField label="Button style" value={builder.design.buttonStyle} options={["solid","outline","pill"]} onChange={(v) => setBuilder((b) => ({ ...b, design: { ...b.design, buttonStyle: v as BuilderConfig["design"]["buttonStyle"] } }))} />
                  <label className="block text-xs"><span className="mb-1 block text-muted-foreground">Corner radius: {builder.design.radius}px</span><input type="range" min="0" max="40" value={builder.design.radius} onChange={(e) => setBuilder((b) => ({ ...b, design: { ...b.design, radius: Number(e.target.value) } }))} className="w-full" /></label>
                </div>
                <button onClick={() => publishBuilder()} disabled={isSaving} className="mt-4 w-full rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground">{isSaving ? "Publishing…" : "Publish design"}</button>
              </div>
            )}

            {panel === "seo" && (
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-xs text-muted-foreground">Control the search title and description used for your public store. These are saved to the real Store record.</p>
                <TextField label="SEO title" value={seoTitleState} onChange={setSeoTitleState} />
                <TextField label="SEO description" value={seoDescriptionState} onChange={setSeoDescriptionState} multiline />
                <div className="mt-3 rounded-md border bg-muted/30 p-3"><p className="text-[11px] font-semibold">Search preview</p><p className="mt-2 text-sm font-medium text-blue-700">{seoTitleState || storeName}</p><p className="text-xs text-muted-foreground">{seoDescriptionState || "Your store description will appear here."}</p></div>
                <button onClick={async () => { setIsSaving(true); const result = await updateStoreSeo(slug, seoTitleState, seoDescriptionState); setIsSaving(false); if (!result.success) { toast.error(result.error); return; } toast.success("SEO saved"); refreshPreview(); }} disabled={isSaving} className="mt-4 w-full rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground">{isSaving ? "Saving…" : "Save SEO"}</button>
              </div>
            )}

            {panel === "content" && (
              <ContentPanel
                slug={slug}
                storeName={storeName}
                theme={theme}
                heroImage={heroImage}
                heroOverrides={heroOverrides}
                storyImage={storyImage}
                storyOverrides={storyOverrides}
                storyDescription={storyDescription}
                onSaved={refreshPreview}
              />
            )}

            {panel === "pages" && (
              <PagesPanel
                slug={slug}
                pages={pages}
                setPages={setPages}
                editingSlug={editingSlug}
                setEditingSlug={setEditingSlug}
                onSaved={refreshPreview}
              />
            )}
          </div>
        )}
      </div>

      {/* Right: live preview */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2.5">
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
              onClick={() => setDevice("desktop")}
              className={`rounded px-2 py-1.5 ${device === "desktop" ? "bg-muted" : "text-muted-foreground hover:bg-muted/50"}`}
              title="Desktop"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDevice("tablet")}
              className={`rounded px-2 py-1.5 ${device === "tablet" ? "bg-muted" : "text-muted-foreground hover:bg-muted/50"}`}
              title="Tablet"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDevice("mobile")}
              className={`rounded px-2 py-1.5 ${device === "mobile" ? "bg-muted" : "text-muted-foreground hover:bg-muted/50"}`}
              title="Mobile"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={refreshPreview}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <RotateCw className="h-3.5 w-3.5" /> Refresh preview
          </button>
        </div>

        <div className="flex flex-1 items-start justify-center overflow-auto bg-muted/40 p-6">
          <iframe
            key={previewKey}
            ref={iframeRef}
            src={previewUrl}
            onLoad={() => { previewReadyRef.current = true; pushPreview(builderRef.current); }}
            title="Live website preview"
            className="h-full min-h-[900px] rounded-lg border border-border bg-white shadow-sm transition-[width] duration-200"
            style={{ width: DEVICE_WIDTH[device] }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Extra pages (About, Gallery, FAQ, Blog, Contact, Policies) beyond the
 * homepage, backed by the StorePage model. Six suggested slugs are always
 * listed — each starts as "not created yet" until the vendor writes and
 * saves content for it, same spirit as Hero/Story in the Content panel — and
 * a vendor can add further custom pages beyond those six.
 */
function pretty(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase()); }

function defaultSectionSettings(type: BuilderSectionType) {
  const headings: Record<string,string> = { hero: "Welcome", catalog: "Shop our collection", about: "Built around what matters", stats: "At a glance", features: "Why choose us", categories: "Categories", testimonials: "What customers say", newsletter: "Get updates from us", contact: "Let's work together", gallery: "Gallery", map: "Find us", faq: "Frequently asked questions", text: "More about us", imageText: "Our story" };
  return { eyebrow: type === "hero" ? "Welcome" : undefined, heading: headings[type], body: type === "hero" ? "Tell customers what makes your business special." : undefined, align: type === "hero" ? "left" as const : "left" as const, padding: "spacious" as const, columns: type === "catalog" ? 4 as const : 3 as const, showButton: true };
}

function SectionSettingsEditor({ section, onChange }: { section: BuilderSection; onChange: (patch: Partial<BuilderSection>) => void }) {
  const s = section.settings;
  const update = (patch: Partial<typeof s>) => onChange({ settings: { ...s, ...patch } });
  return <div className="space-y-2 border-t bg-muted/20 p-3">
    <TextField label="Eyebrow" value={s.eyebrow || ""} onChange={(v) => update({ eyebrow: v })} />
    <TextField label="Heading" value={s.heading || ""} onChange={(v) => update({ heading: v })} />
    <TextField label="Body" value={s.body || ""} multiline onChange={(v) => update({ body: v })} />
    {!["stats","catalog","categories","testimonials","newsletter","contact","gallery","map","faq"].includes(section.type) && <ImageField label="Image" value={s.image || ""} onChange={(v) => update({ image: v })} />}
    <div className="grid grid-cols-2 gap-2"><SelectField label="Alignment" value={s.align || "left"} options={["left","center","right"]} onChange={(v) => update({ align: v as "left"|"center"|"right" })} /><SelectField label="Padding" value={s.padding || "normal"} options={["compact","normal","spacious"]} onChange={(v) => update({ padding: v as "compact"|"normal"|"spacious" })} /></div>
    <TextField label="Button label" value={s.ctaLabel || ""} onChange={(v) => update({ ctaLabel: v })} />
    <TextField label="Button link" value={s.ctaHref || ""} onChange={(v) => update({ ctaHref: v })} />
    <div className="grid grid-cols-2 gap-2"><ColorField label="Section background" value={s.background || "#ffffff"} onChange={(v) => update({ background: v })} /><ColorField label="Section text" value={s.textColor || ""} onChange={(v) => update({ textColor: v })} /></div>
  </div>;
}

function TextField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) { return <label className="block text-[11px]"><span className="mb-1 block text-muted-foreground">{label}</span>{multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded border bg-background px-2 py-1.5 text-xs" /> : <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5 text-xs" />}</label>; }

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Upload failed (${res.status})`);
      onChange(body.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <label className="block text-[11px]">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mb-1.5 h-16 w-full rounded border object-cover" />
      )}
      <div className="flex gap-1.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste an image URL…"
          className="min-w-0 flex-1 rounded border bg-background px-2 py-1.5 text-xs"
        />
        <label className="flex shrink-0 cursor-pointer items-center rounded border bg-background px-2 py-1.5 text-xs hover:bg-muted">
          {isUploading ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {value && (
        <button type="button" onClick={() => onChange("")} className="mt-1 text-[10px] text-muted-foreground underline hover:text-foreground">
          Remove image
        </button>
      )}
      {uploadError && <p className="mt-1 text-[10px] text-destructive">{uploadError}</p>}
    </label>
  );
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="block text-[11px]"><span className="mb-1 block text-muted-foreground">{label}</span><div className="flex gap-1.5"><input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 rounded border" /><input value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 rounded border bg-background px-2 py-1.5 text-xs" /></div></label>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) { return <label className="block text-[11px]"><span className="mb-1 block text-muted-foreground">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5 text-xs">{options.map((o) => <option key={o}>{o}</option>)}</select></label>; }

function PagesPanel({
  slug,
  pages,
  setPages,
  editingSlug,
  setEditingSlug,
  onSaved,
}: {
  slug: string;
  pages: StorePageRow[];
  setPages: Dispatch<SetStateAction<StorePageRow[]>>;
  editingSlug: string | null;
  setEditingSlug: (s: string | null) => void;
  onSaved: () => void;
}) {
  const [addingCustom, setAddingCustom] = useState(false);
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const rows: { slug: string; title: string; page: StorePageRow | null }[] = [
    ...SUGGESTED_PAGE_SLUGS.map((s) => ({ slug: s, title: SUGGESTED_PAGE_TITLES[s], page: bySlug.get(s) ?? null })),
    ...pages.filter((p) => !(SUGGESTED_PAGE_SLUGS as readonly string[]).includes(p.slug)).map((p) => ({ slug: p.slug, title: p.title, page: p })),
  ];

  function upsertLocal(row: StorePageRow) {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id || p.slug === row.slug);
      if (idx === -1) return [...prev, row];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }

  async function handleTogglePublished(page: StorePageRow) {
    const next = !page.isPublished;
    upsertLocal({ ...page, isPublished: next });
    const result = await toggleStorePagePublished(slug, page.id, next);
    if (!result.success) {
      upsertLocal({ ...page, isPublished: !next });
      toast.error(result.error);
      return;
    }
    onSaved();
  }

  async function handleDelete(page: StorePageRow) {
    if (!confirm(`Delete "${page.title}"? This can't be undone.`)) return;
    const result = await deleteStorePage(slug, page.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setPages((prev) => prev.filter((p) => p.id !== page.id));
    toast.success("Page deleted");
    onSaved();
  }

  const editingRow = editingSlug ? rows.find((r) => r.slug === editingSlug) : null;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Extra pages (About, Gallery, FAQ, Blog, Contact, Policies) beyond the homepage. Each is live at{" "}
        <span className="font-mono">/{slug}/&lt;page&gt;</span> once published.
      </p>

      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.slug} className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setEditingSlug(editingSlug === row.slug ? null : row.slug)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted"
            >
              <span className="flex items-center gap-2 truncate">
                <span className="truncate font-medium">{row.title}</span>
                {!row.page && <span className="shrink-0 text-[10px] text-muted-foreground">Not created</span>}
                {row.page && !row.page.isPublished && <span className="shrink-0 text-[10px] text-muted-foreground">Draft</span>}
              </span>
              {editingSlug === row.slug ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
            </button>

            {editingSlug === row.slug && (
              <PageEditor
                slug={slug}
                pageSlug={row.slug}
                initial={row.page}
                onSaved={(row2) => {
                  upsertLocal(row2);
                  onSaved();
                }}
                onTogglePublished={row.page ? () => handleTogglePublished(row.page as StorePageRow) : undefined}
                onDelete={row.page ? () => handleDelete(row.page as StorePageRow) : undefined}
              />
            )}
          </div>
        ))}
      </div>

      {addingCustom ? (
        <div className="mt-2 rounded-md border border-border">
          <PageEditor
            slug={slug}
            pageSlug=""
            initial={null}
            allowSlugEdit
            onSaved={(row2) => {
              upsertLocal(row2);
              setAddingCustom(false);
              setEditingSlug(row2.slug);
              onSaved();
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingCustom(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add custom page
        </button>
      )}
    </div>
  );
}

function PageEditor({
  slug,
  pageSlug,
  initial,
  allowSlugEdit,
  onSaved,
  onTogglePublished,
  onDelete,
}: {
  slug: string;
  pageSlug: string;
  initial: StorePageRow | null;
  allowSlugEdit?: boolean;
  onSaved: (row: StorePageRow) => void;
  onTogglePublished?: () => void;
  onDelete?: () => void;
}) {
  const [customSlug, setCustomSlug] = useState("");
  const [title, setTitle] = useState(initial?.title ?? SUGGESTED_PAGE_TITLES[pageSlug] ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const effectiveSlug = allowSlugEdit ? customSlug : pageSlug;
    if (allowSlugEdit && !effectiveSlug.trim()) {
      toast.error("Give the page a URL slug (e.g. \"shipping\").");
      return;
    }
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set("pageSlug", effectiveSlug);
      formData.set("title", title);
      formData.set("body", body);
      if (isPublished) formData.set("isPublished", "on");
      const result = await saveStorePage(slug, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Page saved");
      onSaved({
        id: initial?.id ?? `${effectiveSlug}-${Date.now()}`,
        slug: effectiveSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        title,
        body,
        isPublished,
      });
    } catch {
      toast.error("Something went wrong saving the page. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-2.5 border-t border-border p-3">
      {allowSlugEdit && (
        <label className="block text-xs">
          <span className="mb-1 block text-muted-foreground">URL slug</span>
          <input
            value={customSlug}
            onChange={(e) => setCustomSlug(e.target.value)}
            placeholder="e.g. shipping"
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
          />
        </label>
      )}
      <label className="block text-xs">
        <span className="mb-1 block text-muted-foreground">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted-foreground">Content</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
        Published
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        {onTogglePublished && (
          <button
            type="button"
            onClick={onTogglePublished}
            title={initial?.isPublished ? "Unpublish" : "Publish"}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted"
          >
            {initial?.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete page"
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
