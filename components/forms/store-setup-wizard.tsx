"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createStore } from "@/lib/actions/store";
import { toast } from "sonner";
import slugify from "slugify";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { TemplateGallery, type TemplateOption } from "@/components/dashboard/template-gallery";
import { FileUploadField } from "@/components/forms/file-upload-field";

type BusinessSnapshot = {
  businessName: string;
  category: string;
  sellsProducts: boolean;
  offersServices: boolean;
};

const STEPS = ["Business", "Branding", "Template", "Review"] as const;
type Step = (typeof STEPS)[number];

export function StoreSetupWizard({
  businessId,
  business,
  templates,
  planRank,
}: {
  businessId: string;
  business: BusinessSnapshot;
  templates: TemplateOption[];
  planRank: number;
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const step: Step = STEPS[stepIndex];

  const [storeName, setStoreName] = useState(business.businessName);
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewSlug = storeName ? slugify(storeName, { lower: true, strict: true }) : "your-store-name";

  // Nudge toward templates matching the business's own category first —
  // the vendor can still browse the full gallery from within this step.
  const suggestedTemplates = useMemo(
    () => templates.filter((t) => t.category === business.category),
    [templates, business.category]
  );

  const selectedTemplate = templates.find((t) => t.id === templateId);

  function canAdvance(): boolean {
    if (step === "Branding") return storeName.trim().length >= 3;
    return true;
  }

  function goNext() {
    if (!canAdvance()) {
      toast.error("Store name must be at least 3 characters");
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handlePublish() {
    setIsSubmitting(true);
    const result = await createStore({ businessId, storeName, templateId, logoUrl, bannerUrl });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Store created! Welcome to BizNest.");
    router.push(`/onboarding/select-plan?slug=${encodeURIComponent(result.data.slug)}`);
  }

  return (
    <div>
      {/* Step tracker */}
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => {
          const isDone = i < stepIndex;
          const isActive = i === stepIndex;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isActive
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`hidden text-xs font-medium sm:inline ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ${isDone ? "bg-primary" : "bg-border"}`} />}
            </li>
          );
        })}
      </ol>

      {/* Step 1: Business snapshot */}
      {step === "Business" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Let's set up {business.businessName}'s store</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll use what you already told us during verification, then walk through branding, a template, and publishing — about two minutes.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Business type</dt>
                <dd className="mt-0.5 font-medium">{business.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">You'll sell</dt>
                <dd className="mt-0.5 font-medium">
                  {business.sellsProducts && business.offersServices
                    ? "Products & Services"
                    : business.sellsProducts
                    ? "Products"
                    : "Services"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Next up: name your store and add a logo, pick a template built for {business.category.toLowerCase()} businesses, then review and publish.
          </div>
        </div>
      )}

      {/* Step 2: Branding */}
      {step === "Branding" && (
        <div className="space-y-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Store name</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Stacey's Paradise"
              autoFocus
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your store will be live at biznest.vercel.app/store/{previewSlug}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FileUploadField label="Logo (optional)" value={logoUrl} onChange={setLogoUrl} />
            <FileUploadField label="Cover image (optional)" value={bannerUrl} onChange={setBannerUrl} />
          </div>
          <p className="text-xs text-muted-foreground">
            Skip either for now — we'll fill your cover with a photo matching your template's style, and you can swap both anytime from your dashboard.
          </p>
        </div>
      )}

      {/* Step 3: Template */}
      {step === "Template" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium">Choose a starting template</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Showing {business.category} templates first — browse the full gallery below if you want a different look.
            </p>
          </div>
          {suggestedTemplates.length > 0 && (
            <TemplateGallery
              templates={suggestedTemplates}
              selectedId={templateId}
              onSelect={setTemplateId}
              planRank={planRank}
            />
          )}
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
              Browse all templates
            </summary>
            <div className="border-t border-border p-4">
              <TemplateGallery templates={templates} selectedId={templateId} onSelect={setTemplateId} planRank={planRank} />
            </div>
          </details>
          <p className="text-xs text-muted-foreground">You can skip this and pick a template later — a default will be assigned.</p>
        </div>
      )}

      {/* Step 4: Review & publish */}
      {step === "Review" && (
        <div className="space-y-5">
          <h3 className="text-sm font-medium">Review your store</h3>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center gap-3 border-b border-border p-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                  No logo
                </div>
              )}
              <div>
                <p className="font-semibold">{storeName}</p>
                <p className="text-xs text-muted-foreground">biznest.vercel.app/store/{previewSlug}</p>
              </div>
            </div>
            <dl className="divide-y divide-border text-sm">
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Template</dt>
                <dd className="font-medium">{selectedTemplate ? selectedTemplate.name : "Default (assigned automatically)"}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Cover image</dt>
                <dd className="font-medium">{bannerUrl ? "Uploaded" : "Auto-filled from template"}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Starter listings</dt>
                <dd className="font-medium">Added automatically — edit or remove anytime</dd>
              </div>
            </dl>
          </div>
          <p className="text-xs text-muted-foreground">
            After publishing, you'll land in your dashboard to add real products or services and connect a payout account.
          </p>
        </div>
      )}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0 || isSubmitting}
          className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-0"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {step !== "Review" ? (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePublish}
            disabled={isSubmitting || storeName.trim().length < 3}
            className="flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Publishing…" : "Publish my store"}
          </button>
        )}
      </div>
    </div>
  );
}
