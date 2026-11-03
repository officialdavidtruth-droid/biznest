"use client";

import { useState } from "react";
import { TemplateGallery, type TemplateOption } from "@/components/dashboard/template-gallery";
import { setStoreTemplate } from "@/lib/actions/template";
import { toast } from "sonner";

export function BuilderClient({
  slug,
  templates,
  currentTemplateId,
  planRank,
}: {
  slug: string;
  templates: TemplateOption[];
  currentTemplateId: string | null;
  planRank: number;
}) {
  const [selected, setSelected] = useState<string | null>(currentTemplateId);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSelect(id: string) {
    if (isSaving || id === selected) return;
    // Switching to a different template resets the store's colors and font and removes any saved
    // Website Builder layout (see setStoreTemplate), so ask first. Same wording as the Templates page.
    if (selected) {
      const next = templates.find((t) => t.id === id);
      const ok = window.confirm(
        `Switch to "${next?.name ?? "this template"}"?\n\nThis resets your store's colors and font and removes any layout you saved in the Website Builder. Your products, text content and settings are kept.\n\nThis can't be undone.`,
      );
      if (!ok) return;
    }
    setIsSaving(true);
    const result = await setStoreTemplate(slug, id);
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    // Only mark it selected once the server has actually applied it.
    setSelected(id);
    toast.success("Template applied");
  }

  return (
    <div>
      <TemplateGallery templates={templates} selectedId={selected} onSelect={handleSelect} planRank={planRank} />
      {isSaving && <p className="mt-4 text-xs text-muted-foreground">Applying template…</p>}
    </div>
  );
}
