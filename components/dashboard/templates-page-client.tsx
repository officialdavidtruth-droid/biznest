"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Check } from "lucide-react";
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
}: {
  slug: string;
  storeName: string;
  templates: TemplateOption[];
  currentTemplateId: string | null;
  currentTemplateName: string | null;
  planRank: number;
}) {
  const [templateId, setTemplateId] = useState<string | null>(currentTemplateId);
  const [templateName, setTemplateName] = useState<string | null>(currentTemplateName);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSelect(id: string) {
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
      />

      {isSaving && <p className="mt-4 text-xs text-muted-foreground">Applying template…</p>}
    </div>
  );
}
