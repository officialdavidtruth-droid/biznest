"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  X, Monitor, Tablet, Smartphone, LayoutTemplate, Rows3, ChevronRight,
  ArrowUp, ArrowDown, RotateCw, PenSquare, FileText, Trash2, Eye, EyeOff, Plus, ChevronDown,
} from "lucide-react";
import { updateSectionOverrides } from "@/lib/actions/sections";
import { saveStorePage, toggleStorePagePublished, deleteStorePage, SUGGESTED_PAGE_SLUGS, SUGGESTED_PAGE_TITLES } from "@/lib/actions/pages";
import type { Section, TemplateTheme } from "@/lib/template-themes";
import type { HeroOverrides, StoryOverrides } from "@/lib/actions/store";
import { ContentPanel } from "@/components/dashboard/content-panel";

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

type Panel = "sections" | "content" | "pages" | null;

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
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [order, setOrder] = useState<Section[]>(initialOrder);
  const [hidden, setHidden] = useState<Set<Section>>(new Set(initialHidden));
  const [isSaving, setIsSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [pages, setPages] = useState<StorePageRow[]>(initialPages);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = useMemo(() => `/store/${slug}?preview=1`, [slug]);

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
    const formData = new FormData();
    for (const s of order) formData.append("order", s);
    for (const s of hidden) formData.append(`hidden-${s}`, "on");
    const result = await updateSectionOverrides(slug, formData);
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Layout published");
    refreshPreview();
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
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Reorder, hide, or add sections. A section still won't show live if it has nothing
                  real behind it yet (e.g. Testimonials with zero reviews).
                </p>
                <div className="space-y-1.5">
                  {order.map((s, i) => (
                    <div key={s} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className={hidden.has(s) ? "text-muted-foreground line-through" : ""}>{SECTION_LABELS[s]}</span>
                      <div className="flex items-center gap-2">
                        {s !== "hero" && (
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <input type="checkbox" checked={hidden.has(s)} onChange={() => toggleHidden(s)} />
                            Hide
                          </label>
                        )}
                        <button type="button" onClick={() => move(i, -1)} disabled={i <= 1} className="rounded p-1 hover:bg-muted disabled:opacity-30">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === 0 || i === order.length - 1} className="rounded p-1 hover:bg-muted disabled:opacity-30">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={saveSections}
                  disabled={isSaving}
                  className="mt-4 w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {isSaving ? "Publishing…" : "Publish layout"}
                </button>
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
    const formData = new FormData();
    formData.set("pageSlug", effectiveSlug);
    formData.set("title", title);
    formData.set("body", body);
    if (isPublished) formData.set("isPublished", "on");
    const result = await saveStorePage(slug, formData);
    setIsSaving(false);
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
