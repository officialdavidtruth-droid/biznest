"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { setStoreTemplate } from "@/lib/actions/template";
import { TemplateGallery, type TemplateOption } from "@/components/dashboard/template-gallery";

/**
 * Dedicated "choose a template" page. Applying here is the single source of
 * truth for a store's template -- Customize Website (customizer-client.tsx)
 * no longer offers a browse-all-templates panel; it just shows whichever one
 * was picked here and links back to this page to change it.
 */
export function TemplatesPageClient({
  slug,
  storeName,
  templates,
  currentTemplateId,
  currentTemplateName,
  planRank,
  businessCategory,
}: {
  slug: string;
  storeName: string;
  templates: TemplateOption[];
  currentTemplateId: string | null;
  currentTemplateName: string | null;
  planRank: number;
  businessCategory: string | null;
}) {
  const [templateId, setTemplateId] = useState<string | null>(currentTemplateId);
  const [templateName, setTemplateName] = useState<string | null>(currentTemplateName);
  const [isSaving, setIsSaving] = useState(false);

  const [pendingId, setPendingId] = useState<string | null>(null);

  async function applyTemplate(id: string) {
    setIsSaving(true);
    const result = await setStoreTemplate(slug, id);
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setTemplateId(id);
    setTemplateName(templates.find((t) => t.id === id)?.name ?? null);
    toast.success("Template applied to your store");
  }

  function handleSelect(id: string) {
    if (isSaving) return;
    // Switching to a different template resets the store's colors and font and
    // removes any saved Website Builder layout (see setStoreTemplate), so ask first.
    // Re-selecting the template already in use changes nothing and needs no prompt.
    if (templateId && id !== templateId) {
      setPendingId(id);
      return;
    }
    void applyTemplate(id);
  }

  const pendingName = pendingId ? templates.find((t) => t.id === pendingId)?.name ?? "this template" : null;

  return (
    <div className="max-w-6xl">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Templates</h1>
        {templateId && (
          <Link
            href={`/${slug}/admin/customize`}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:brightness-110"
          >
            Continue to Customize Website <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs"><Sparkles className="h-4 w-4 text-primary" /><span><strong>Recommended for {businessCategory || "your business"}.</strong> Templates and homepage structure can be tailored to your business journey.</span></div>
      <p className="mb-2 text-sm text-muted-foreground">
        Pick the template {storeName} runs on. Only the template chosen here shows up in Customize Website —
        change it any time by coming back to this page.
      </p>
      {templateName && (
        <p className="mb-6 flex items-center gap-1.5 text-xs font-medium text-primary">
          <Check className="h-3.5 w-3.5" /> Currently using: {templateName}
        </p>
      )}
      {!templateName && <div className="mb-6" />}

      <TemplateGallery
        templates={templates}
        selectedId={templateId}
        onSelect={handleSelect}
        planRank={planRank}
        businessCategory={businessCategory}
      />

      {pendingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Switch template">
          <div className="w-full max-w-md rounded-xl bg-background p-5 shadow-xl">
            <h2 className="text-base font-semibold">Switch to &ldquo;{pendingName}&rdquo;?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This resets your store&apos;s colors and font and removes any layout you saved in the Website Builder. Your products, text content and settings are kept. This can&apos;t be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingId(null)} className="rounded-md border border-border px-3 py-2 text-xs font-medium">Keep current template</button>
              <button type="button" onClick={() => { const id = pendingId; setPendingId(null); void applyTemplate(id); }} className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Switch template</button>
            </div>
          </div>
        </div>
      )}

      {isSaving && <p className="mt-4 text-xs text-muted-foreground">Applying template…</p>}
    </div>
  );
}
