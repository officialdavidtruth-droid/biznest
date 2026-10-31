"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import {
  X, Monitor, Tablet, Smartphone, LayoutTemplate, Rows3, ChevronRight,
  ArrowUp, ArrowDown, RotateCw, PenSquare, FileText, Trash2, Eye, EyeOff, Plus, ChevronDown,
} from "lucide-react";
import { saveStorePage, toggleStorePagePublished, deleteStorePage } from "@/lib/actions/pages";
import { SUGGESTED_PAGE_SLUGS, SUGGESTED_PAGE_TITLES } from "@/lib/actions/pages-constants";
import type { TemplateTheme } from "@/lib/template-themes";
import type { HeroOverrides, StoryOverrides } from "@/lib/actions/store";
import { ContentPanel } from "@/components/dashboard/content-panel";
import { saveBuilderConfig, updateStoreSeo, resetBuilderToTemplate } from "@/lib/actions/builder";
import { BUILDER_SECTION_TYPES, readBuilderConfig, type BuilderConfig, type BuilderSection, type BuilderSectionItem, type BuilderSectionType } from "@/lib/builder-config";
import { defaultFaqItems, defaultFeatureItems } from "@/lib/builder-defaults";
import { PAGE_FORMAT_HINTS } from "@/lib/storefront/owner-page-format";
import { buildIndustryHomepage, getBusinessExperience } from "@/lib/business-experience";

export type StorePageRow = { id: string; slug: string; title: string; body: string; isPublished: boolean };

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };

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
  theme,
  heroImage,
  heroOverrides,
  storyImage,
  storyOverrides,
  storyDescription,
  pages: initialPages,
  initialBuilder,
  businessCategory,
  sellsProducts,
  offersServices,
  seoTitle,
  seoDescription,
  templateHasOwnHomepage = false,
  builderPublished = false,
}: {
  slug: string;
  storeName: string;
  currentTemplateName: string | null;
  theme: TemplateTheme;
  heroImage: string | null;
  heroOverrides: HeroOverrides;
  storyImage: string | null;
  storyOverrides: StoryOverrides;
  storyDescription: string | null;
  pages: StorePageRow[];
  initialBuilder: BuilderConfig;
  businessCategory: string | null;
  sellsProducts: boolean;
  offersServices: boolean;
  seoTitle: string;
  seoDescription: string;
  /** True when the chosen template draws its own homepage (legacy, hotel, signature...) instead of the shared builder. */
  templateHasOwnHomepage?: boolean;
  /** True when a visual-builder layout has been published for this store (it replaces the template's own homepage). */
  builderPublished?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  // Below the lg breakpoint the controls and the preview cannot sit side by side, so show one at a time.
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<Device>("desktop");
  const [isSaving, setIsSaving] = useState(false);
  const [published, setPublished] = useState(builderPublished);
  const [previewKey, setPreviewKey] = useState(0);
  const [pages, setPages] = useState<StorePageRow[]>(initialPages);
  const [builder, setBuilder] = useState<BuilderConfig>(initialBuilder);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(initialBuilder.sections[0]?.id ?? null);
  const [seoTitleState, setSeoTitleState] = useState(seoTitle);
  const [seoDescriptionState, setSeoDescriptionState] = useState(seoDescription);
  const experience = getBusinessExperience(businessCategory, { sellsProducts, offersServices });
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const builderRef = useRef<BuilderConfig>(initialBuilder);
  const previewReadyRef = useRef(false);

  // Unsaved-changes tracking: `savedJson` is the last published (or loaded) layout; any difference is an unpublished draft.
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialBuilder));
  const [restoredDraft, setRestoredDraft] = useState(false);
  const dirty = useMemo(() => JSON.stringify(builder) !== savedJson, [builder, savedJson]);
  const draftKey = `biznest-builder-draft:${slug}`;

  // Bring back an unpublished draft left by a reload or closed tab.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { base?: string; config?: unknown };
      // Drafts are stored with the published layout they started from; older ones were the bare config.
      const draft = readBuilderConfig(parsed && "config" in parsed ? parsed.config : parsed);
      const stale = !!parsed?.base && parsed.base !== JSON.stringify(initialBuilder);
      if (draft && stale && !confirm("The published layout changed since you saved this draft (someone else may have published). Restore your old draft anyway?")) {
        localStorage.removeItem(draftKey);
      } else if (draft && JSON.stringify(draft) !== JSON.stringify(initialBuilder)) {
        setBuilder(draft);
        setSelectedSectionId(draft.sections[0]?.id ?? null);
        setRestoredDraft(true);
      } else localStorage.removeItem(draftKey);
    } catch { /* storage unavailable or corrupt: start from the saved layout */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the draft in this browser while it differs from what is published.
  useEffect(() => {
    try {
      if (dirty) localStorage.setItem(draftKey, JSON.stringify({ base: savedJson, config: builder }));
      else localStorage.removeItem(draftKey);
    } catch { /* ignore */ }
  }, [builder, dirty, draftKey, savedJson]);

  // Warn before closing or reloading the tab with unpublished changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function discardDraft() {
    if (!confirm("Discard your unpublished changes and go back to the published layout?")) return;
    const saved = JSON.parse(savedJson) as BuilderConfig;
    setBuilder(saved);
    setSelectedSectionId(saved.sections[0]?.id ?? null);
    setRestoredDraft(false);
  }

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
        setMobileView("edit");
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

  async function publishBuilder(next = builder) {
    setIsSaving(true);
    try {
      const result = await saveBuilderConfig(slug, next);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Website published");
      setBuilder(next);
      setSavedJson(JSON.stringify(next));
      setRestoredDraft(false);
      setPublished(true);
      refreshPreview();
    } catch {
      toast.error("Something went wrong publishing your website. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function restoreTemplateHomepage() {
    setIsSaving(true);
    try {
      const result = await resetBuilderToTemplate(slug);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Template homepage restored");
      setPublished(false);
      refreshPreview();
    } catch {
      toast.error("Something went wrong restoring the template homepage. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateBuilderSection(id: string, patch: Partial<BuilderSection>) {
    setBuilder((current) => ({ ...current, sections: current.sections.map((s) => s.id === id ? { ...s, ...patch } : s) }));
  }

  function addBuilderSection(type: BuilderSectionType) {
    if (builder.sections.length >= 30) { toast.error("A homepage can have at most 30 sections."); return; }
    const id = `${type}-${Date.now()}`;
    const section: BuilderSection = { id, type, visible: true, settings: defaultSectionSettings(type) };
    setBuilder((current) => ({ ...current, sections: [...current.sections, section] }));
    setSelectedSectionId(id);
  }

  function removeBuilderSection(id: string) {
    const target = builder.sections.find((s) => s.id === id);
    // Template-generated sections have ids like "hero-0", so protect the hero by type, not by id.
    if (!target || target.type === "hero") return;
    if (!confirm(`Remove this ${pretty(target.type)} section? Use Discard to undo before you publish.`)) return;
    const remaining = builder.sections.filter((s) => s.id !== id);
    setBuilder((current) => ({ ...current, sections: current.sections.filter((s) => s.id !== id) }));
    setSelectedSectionId(remaining[0]?.id ?? null);
  }

  function moveBuilderSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= builder.sections.length) return;
    const next = [...builder.sections];
    [next[index], next[target]] = [next[target], next[index]];
    setBuilder((current) => ({ ...current, sections: next }));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-muted/20 lg:flex-row">
      {/* Small screens: switch between the controls and the live preview */}
      <div className="flex shrink-0 gap-1 border-b border-border bg-background p-1.5 lg:hidden" role="tablist" aria-label="Editor view">
        {(["edit", "preview"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={mobileView === v} onClick={() => setMobileView(v)} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${mobileView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {v === "edit" ? "Edit" : "Preview"}{v === "edit" && dirty ? " •" : ""}
          </button>
        ))}
      </div>
      {/* Left control panel */}
      <div className={`${mobileView === "edit" ? "flex" : "hidden"} min-h-0 w-full flex-1 flex-col bg-background lg:flex lg:h-full lg:w-[380px] lg:flex-none lg:shrink-0 lg:border-r lg:border-border`}>
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          {/* Plain <a>, not <Link>: this whole page is a full-screen preview
              of the actual storefront template, rendered directly rather
              than in an isolated iframe. Client-side navigation back to
              /admin can leave that rendered preview content behind instead
              of properly swapping in the dashboard -- same class of bug as
              the "BizNest PMS" link fix in sidebar.tsx (shared layouts
              persisting across client-side navigation between sibling
              routes; see that file's comment for the full explanation). A
              full page load always renders the destination cleanly. */}
          <a
            href={`/${slug}/admin`}
            aria-label="Close editor"
            onClick={(e) => { if (dirty && !confirm("You have unpublished changes. Leave anyway? (They are kept in this browser for next time.)")) e.preventDefault(); }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </a>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Customize</p>
            <p className="truncate text-xs text-muted-foreground">{storeName}</p>
          </div>
          {dirty && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">Unpublished changes</span>
              <button type="button" onClick={discardDraft} className="text-[10px] text-muted-foreground underline hover:text-foreground">Discard</button>
            </div>
          )}
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
              {/* Plain <a>, same reasoning as the close button above --
                  leaving this live-preview page needs a full reload. */}
              <a
                href={`/${slug}/admin/templates`}
                className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Change
              </a>
            </div>
            {restoredDraft && dirty && (
              <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">Restored your unpublished draft from this browser. Publish to make it live, or Discard to go back.</div>
            )}
            {templateHasOwnHomepage && (
              <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-[11px] text-amber-900">
                {published ? (
                  <>
                    <p className="font-semibold">Your visual website replaces this template&apos;s homepage</p>
                    <p className="mt-1">{currentTemplateName ?? "This template"} has its own homepage design, but the layout you published here is what visitors see now.</p>
                    <button type="button" disabled={isSaving} onClick={restoreTemplateHomepage} className="mt-2 inline-block font-semibold underline disabled:opacity-50">Restore the {currentTemplateName ?? "template"} homepage</button>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">This template has its own homepage design</p>
                    <p className="mt-1">The preview shows your visual-builder draft. Nothing changes on your live homepage until you publish; publishing replaces {currentTemplateName ?? "the template"}&apos;s homepage with this layout.</p>
                  </>
                )}
              </div>
            )}
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
                onClick={() => { if (!confirm("Replace your current draft with the recommended homepage? Unpublished edits will be lost.")) return; const next = buildIndustryHomepage(businessCategory, storeName, storyDescription, heroImage, { sellsProducts, offersServices }); setBuilder(next); setSelectedSectionId(next.sections[0]?.id ?? null); setPanel("sections"); }}
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
                            <button type="button" onClick={() => moveBuilderSection(index, -1)} aria-label="Move section up" disabled={index === 0} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                            <button type="button" onClick={() => moveBuilderSection(index, 1)} aria-label="Move section down" disabled={index === builder.sections.length - 1} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                            {section.type !== "hero" && <button type="button" onClick={() => removeBuilderSection(section.id)} aria-label="Remove section" className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>}
                          </div>
                        </div>
                        {selectedSectionId === section.id && <SectionSettingsEditor section={section} mode={experience.mode} onChange={(patch) => updateBuilderSection(section.id, patch)} />}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t p-3"><button onClick={() => publishBuilder()} disabled={isSaving} className="w-full rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{isSaving ? "Publishing…" : "Publish visual website"}</button></div>
              </div>
            )}

            {panel === "design" && (
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-xs text-muted-foreground">These controls change the published visual builder. Publishing saves your whole draft, including any section edits you have made.</p>
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
                <button onClick={() => publishBuilder()} disabled={isSaving} className="mt-4 w-full rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground">{isSaving ? "Publishing…" : "Publish all changes"}</button>
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
                builderHome={!templateHasOwnHomepage || published}
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
      <div className={`${mobileView === "preview" ? "flex" : "hidden"} min-h-0 flex-1 flex-col overflow-hidden lg:flex`}>
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

        <div className="flex flex-1 items-start justify-center overflow-auto bg-muted/40 p-2 lg:p-6">
          <iframe
            key={previewKey}
            ref={iframeRef}
            src={previewUrl}
            onLoad={() => { previewReadyRef.current = true; pushPreview(builderRef.current); }}
            title="Live website preview"
            className="h-full min-h-[900px] rounded-lg border border-border bg-background shadow-sm transition-[width] duration-200"
            style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}
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

function SectionSettingsEditor({ section, mode, onChange }: { section: BuilderSection; mode: string; onChange: (patch: Partial<BuilderSection>) => void }) {
  const s = section.settings;
  const update = (patch: Partial<typeof s>) => onChange({ settings: { ...s, ...patch } });
  return <div className="space-y-2 border-t bg-muted/20 p-3">
    <TextField maxLength={120} label="Eyebrow" value={s.eyebrow || ""} onChange={(v) => update({ eyebrow: v })} />
    <TextField maxLength={180} label="Heading" value={s.heading || ""} onChange={(v) => update({ heading: v })} />
    <TextField maxLength={4000} label="Body" value={s.body || ""} multiline onChange={(v) => update({ body: v })} />
    {!["stats","catalog","categories","testimonials","newsletter","contact","gallery","map","faq","features"].includes(section.type) && <ImageField label="Image" value={s.image || ""} onChange={(v) => update({ image: v })} />}
    {section.type === "features" && <ItemsEditor label="Features" titleLabel="Feature title" bodyLabel="Description" items={s.items} defaults={defaultFeatureItems(mode)} onChange={(items) => update({ items })} />}
    {section.type === "faq" && <ItemsEditor label="Questions" titleLabel="Question" bodyLabel="Answer" items={s.items} defaults={defaultFaqItems(mode)} onChange={(items) => update({ items })} />}
    {section.type === "gallery" && <GalleryImagesEditor images={s.images} onChange={(images) => update({ images })} />}
    {section.type === "map" && <TextField label="Address or place name" value={s.address || ""} onChange={(v) => update({ address: v })} />}
    {section.type === "map" && <p className="text-[10px] text-muted-foreground">Leave blank to use your business city and state.</p>}
    <div className="grid grid-cols-2 gap-2"><SelectField label="Alignment" value={s.align || "left"} options={["left","center","right"]} onChange={(v) => update({ align: v as "left"|"center"|"right" })} /><SelectField label="Padding" value={s.padding || "normal"} options={["compact","normal","spacious"]} onChange={(v) => update({ padding: v as "compact"|"normal"|"spacious" })} /></div>
    <TextField maxLength={80} label="Button label" value={s.ctaLabel || ""} onChange={(v) => update({ ctaLabel: v })} />
    <TextField maxLength={500} label="Button link" value={s.ctaHref || ""} onChange={(v) => update({ ctaHref: v })} />
    <div className="grid grid-cols-2 gap-2"><ColorField label="Section background" value={s.background || "#ffffff"} onChange={(v) => update({ background: v })} /><ColorField label="Section text" value={s.textColor || ""} onChange={(v) => update({ textColor: v })} /></div>
  </div>;
}

/** Editable list for Features and FAQ. With nothing saved yet, shows the starter text and lets the owner take it over. */
function ItemsEditor({ label, titleLabel, bodyLabel, items, defaults, onChange }: { label: string; titleLabel: string; bodyLabel: string; items: BuilderSectionItem[] | undefined; defaults: BuilderSectionItem[]; onChange: (items: BuilderSectionItem[]) => void }) {
  const list = items ?? [];
  const set = (i: number, patch: Partial<BuilderSectionItem>) => onChange(list.map((it, n) => (n === i ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-2 rounded border bg-background p-2">
      <div className="flex items-center justify-between"><span className="text-[11px] font-semibold">{label}</span><span className="text-[10px] text-muted-foreground">{list.length ? `${list.length}/12` : "Starter text shown"}</span></div>
      {list.length === 0 && (
        <div className="space-y-1.5">
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">{defaults.map((d) => <li key={d.title}>{d.title}</li>)}</ul>
          <button type="button" onClick={() => onChange(defaults.map((d) => ({ ...d })))} className="w-full rounded border px-2 py-1.5 text-[11px] font-medium hover:bg-muted">Edit these</button>
        </div>
      )}
      {list.map((it, i) => (
        <div key={i} className="space-y-1.5 rounded border border-dashed p-2">
          <TextField maxLength={160} label={titleLabel} value={it.title} onChange={(v) => set(i, { title: v })} />
          <TextField maxLength={1200} label={bodyLabel} value={it.body || ""} multiline onChange={(v) => set(i, { body: v })} />
          <button type="button" onClick={() => onChange(list.filter((_, n) => n !== i))} className="text-[10px] text-muted-foreground underline hover:text-destructive">Remove</button>
        </div>
      ))}
      {list.length > 0 && list.length < 12 && <button type="button" onClick={() => onChange([...list, { title: "", body: "" }])} className="w-full rounded border px-2 py-1.5 text-[11px] font-medium hover:bg-muted">Add another</button>}
    </div>
  );
}

/** The owner's own gallery photos. With none, the live gallery falls back to catalogue photos. */
function GalleryImagesEditor({ images, onChange }: { images: string[] | undefined; onChange: (images: string[]) => void }) {
  const list = images ?? [];
  return (
    <div className="space-y-2 rounded border bg-background p-2">
      <div className="flex items-center justify-between"><span className="text-[11px] font-semibold">Gallery photos</span><span className="text-[10px] text-muted-foreground">{list.length ? `${list.length}/24` : "Using catalogue photos"}</span></div>
      {list.map((url, i) => (
        <div key={i} className="space-y-1">
          <ImageField label={`Photo ${i + 1}`} value={url} onChange={(v) => onChange(v ? list.map((u, n) => (n === i ? v : u)) : list.filter((_, n) => n !== i))} />
        </div>
      ))}
      {list.length < 24 && <button type="button" onClick={() => onChange([...list, ""])} className="w-full rounded border px-2 py-1.5 text-[11px] font-medium hover:bg-muted">Add a photo</button>}
    </div>
  );
}

function TextField({ label, value, onChange, multiline = false, maxLength }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; maxLength?: number }) { return <label className="block text-[11px]"><span className="mb-1 block text-muted-foreground">{label}</span>{multiline ? <textarea maxLength={maxLength} value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded border bg-background px-2 py-1.5 text-xs" /> : <input maxLength={maxLength} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5 text-xs" />}</label>; }

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
    <div className="block text-[11px]">
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
    </div>
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
        <span className="font-mono">{slug}.biznest.space/&lt;page&gt;</span> (or your custom domain) once published.
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
        // Real database id from the server, so Publish/Unpublish and Delete work immediately
        // for a page created in this session (a made-up client id made them fail with "Page not found").
        id: result.data.id,
        slug: result.data.slug,
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
        {PAGE_FORMAT_HINTS[pageSlug] && <span className="mb-1 block text-[10px] text-muted-foreground">{PAGE_FORMAT_HINTS[pageSlug]}</span>}
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
