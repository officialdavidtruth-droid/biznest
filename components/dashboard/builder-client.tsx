"use client";

import { useState } from "react";
import { TemplateGallery, type TemplateOption } from "@/components/dashboard/template-gallery";
import { setStoreTemplate } from "@/lib/actions/template";
import { toast } from "sonner";

export function BuilderClient({
  slug,
  templates,
  currentTemplateId,
}: {
  slug: string;
  templates: TemplateOption[];
  currentTemplateId: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(currentTemplateId);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSelect(id: string) {
    setSelected(id);
    setIsSaving(true);
    const result = await setStoreTemplate(slug, id);
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Template applied");
  }

  return (
    <div>
      <TemplateGallery templates={templates} selectedId={selected} onSelect={handleSelect} />
      {isSaving && <p className="mt-4 text-xs text-muted-foreground">Applying template…</p>}
    </div>
  );
}
