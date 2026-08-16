"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStore } from "@/lib/actions/store";
import { toast } from "sonner";
import slugify from "slugify";
import { TemplateGallery, type TemplateOption } from "@/components/dashboard/template-gallery";

export function CreateStoreForm({
  businessId,
  templates,
  planRank,
}: {
  businessId: string;
  templates: TemplateOption[];
  planRank: number;
}) {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewSlug = storeName ? slugify(storeName, { lower: true, strict: true }) : "your-store-name";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await createStore({ businessId, storeName, templateId });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Store created!");
    router.push(`/onboarding/select-plan?slug=${encodeURIComponent(result.data.slug)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium">Store name</label>
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="Stacey's Paradise"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Your store will be live at biznest.vercel.app/store/{previewSlug}
        </p>
      </div>

      {templates.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Choose a starting template</p>
          <TemplateGallery templates={templates} selectedId={templateId} onSelect={setTemplateId} planRank={planRank} />
        </div>
      )}

      <button
        type="submit"
        disabled={!storeName || isSubmitting}
        className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isSubmitting ? "Creating store…" : "Create store"}
      </button>
    </form>
  );
}
