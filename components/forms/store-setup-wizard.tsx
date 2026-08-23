"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createStore } from "@/lib/actions/store";
import { toast } from "sonner";
import slugify from "slugify";
import { Check, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { TemplateGallery, type TemplateOption } from "@/components/dashboard/template-gallery";
import { FileUploadField } from "@/components/forms/file-upload-field";
import { getBusinessOnboardingPlan, type OnboardingField } from "@/lib/onboarding-business";

type BusinessSnapshot = {
  businessName: string;
  category: string;
  sellsProducts: boolean;
  offersServices: boolean;
};

type ProfileValue = string | number | boolean | string[];
type Profile = Record<string, ProfileValue>;

const STEPS = ["Business", "Setup", "Branding", "Template", "Review"] as const;
type Step = (typeof STEPS)[number];

function fieldIsEmpty(value: ProfileValue | undefined) {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function FieldControl({ field, value, onChange }: { field: OnboardingField; value: ProfileValue | undefined; onChange: (value: ProfileValue) => void }) {
  const stringValue = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const className = "w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15";

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${className} min-h-24 resize-y`}
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <input
      className={className}
      type={field.type === "number" ? "number" : "text"}
      value={stringValue}
      onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
      placeholder={field.placeholder}
      min={field.type === "number" ? 0 : undefined}
    />
  );
}

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
  const [profile, setProfile] = useState<Profile>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const plan = useMemo(
    () => getBusinessOnboardingPlan(business.category, business.sellsProducts, business.offersServices),
    [business.category, business.sellsProducts, business.offersServices]
  );
  const PlanIcon = plan.icon;

  const previewSlug = storeName ? slugify(storeName, { lower: true, strict: true }) : "your-store-name";
  const suggestedTemplates = useMemo(
    () => templates.filter((t) => t.category === business.category),
    [templates, business.category]
  );
  const selectedTemplate = templates.find((t) => t.id === templateId);

  function updateProfile(key: string, value: ProfileValue) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function canAdvance(): boolean {
    if (step === "Branding") return storeName.trim().length >= 3;
    if (step === "Setup") return plan.fields.every((field) => !fieldIsEmpty(profile[field.key]));
    return true;
  }

  function goNext() {
    if (!canAdvance()) {
      if (step === "Branding") toast.error("Store name must be at least 3 characters");
      else toast.error("Complete the setup questions so BizNest can personalise your store.");
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handlePublish() {
    setIsSubmitting(true);
    try {
      const result = await createStore({ businessId, storeName, templateId, logoUrl, bannerUrl, onboardingProfile: profile });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Store created! Your industry setup is ready.");
      router.push(`/onboarding/select-plan?slug=${encodeURIComponent(result.data.slug)}`);
    } catch {
      toast.error("Something went wrong creating your store. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 overflow-hidden rounded-3xl bg-[var(--bn-ink)] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-300">
              <Sparkles className="h-4 w-4" /> BizNest business setup
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Let&apos;s build the right store for your business.</h1>
            <p className="mt-2 text-sm leading-6 text-white/70">Answer a few industry-specific questions. BizNest will use your answers to prepare the right storefront structure, recommendations and merchant setup.</p>
          </div>
          <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/10 sm:flex">
            <PlanIcon className="h-9 w-9 text-emerald-300" />
          </div>
        </div>
      </div>

      <ol className="mb-8 grid grid-cols-5 gap-2">
        {STEPS.map((label, i) => {
          const isDone = i < stepIndex;
          const isActive = i === stepIndex;
          return (
            <li key={label} className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${isDone ? "bg-primary text-primary-foreground" : isActive ? "border-2 border-primary bg-primary/5 text-primary" : "border border-border bg-muted/30 text-muted-foreground"}`}>
                  {isDone ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`hidden truncate text-xs font-medium sm:block ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`ml-10 mt-2 h-px ${i < stepIndex ? "bg-primary" : "bg-border"}`} />}
            </li>
          );
        })}
      </ol>

      {step === "Business" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Step 1 · Business profile</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">We already know the basics.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">We&apos;ll keep your verified business information and use it to choose the right tools. Next, we&apos;ll ask only the questions that matter for {business.category.toLowerCase()}.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <InfoCard label="Business" value={business.businessName} />
            <InfoCard label="Industry" value={business.category} />
            <InfoCard label="Model" value={business.sellsProducts && business.offersServices ? "Products + services" : business.sellsProducts ? "Products" : "Services"} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {plan.checklist.map((item) => <FeaturePill key={item} text={item} />)}
          </div>
        </div>
      )}

      {step === "Setup" && (
        <div className="space-y-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Step 2 · Industry setup</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{plan.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{plan.description}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                {plan.fields.map((field) => (
                  <label key={field.key} className={`block ${field.type === "textarea" ? "sm:col-span-2" : ""}`}>
                    <span className="mb-1.5 block text-sm font-semibold">{field.label}</span>
                    <FieldControl field={field} value={profile[field.key]} onChange={(value) => updateProfile(field.key, value)} />
                    {field.helper && <span className="mt-1 block text-xs text-muted-foreground">{field.helper}</span>}
                  </label>
                ))}
              </div>
            </div>

            <aside className="rounded-2xl bg-muted/50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">What BizNest will prepare</p>
              <ul className="mt-4 space-y-3 text-sm">
                {plan.recommendations.map((item) => (
                  <li key={item} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{item}</span></li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      )}

      {step === "Branding" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Step 3 · Branding</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Make it yours.</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your brand name and images will be carried through the storefront and the customer journey.</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
            <label className="mb-5 block">
              <span className="mb-1.5 block text-sm font-semibold">Store name</span>
              <input className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Stacey&apos;s Paradise" autoFocus />
              <span className="mt-1.5 block text-xs text-muted-foreground">Your store will be live at biznest.vercel.app/store/{previewSlug}</span>
            </label>
            <div className="grid gap-6 sm:grid-cols-2">
              <FileUploadField label="Logo (optional)" value={logoUrl} onChange={setLogoUrl} />
              <FileUploadField label="Cover image (optional)" value={bannerUrl} onChange={setBannerUrl} />
            </div>
          </div>
        </div>
      )}

      {step === "Template" && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Step 4 · Design</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Choose the look that fits your business.</h2>
            <p className="mt-2 text-sm text-muted-foreground">Templates matching {business.category} appear first. You can change the template later without rebuilding your catalog.</p>
          </div>
          {suggestedTemplates.length > 0 && <TemplateGallery templates={suggestedTemplates} selectedId={templateId} onSelect={setTemplateId} planRank={planRank} />}
          <details className="rounded-2xl border border-border bg-background">
            <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold">Browse all templates</summary>
            <div className="border-t border-border p-5"><TemplateGallery templates={templates} selectedId={templateId} onSelect={setTemplateId} planRank={planRank} /></div>
          </details>
        </div>
      )}

      {step === "Review" && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Step 5 · Review</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Everything is ready.</h2>
            <p className="mt-2 text-sm text-muted-foreground">Review the setup before BizNest creates your store.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
            <div className="flex items-center gap-4 border-b border-border p-5">
              {logoUrl ? <img src={logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">Logo</div>}
              <div><p className="font-bold">{storeName}</p><p className="text-xs text-muted-foreground">{business.category} · /store/{previewSlug}</p></div>
            </div>
            <dl className="divide-y divide-border text-sm">
              <ReviewRow label="Business model" value={business.sellsProducts && business.offersServices ? "Products + services" : business.sellsProducts ? "Products" : "Services"} />
              <ReviewRow label="Template" value={selectedTemplate?.name ?? "Default (assigned automatically)"} />
              <ReviewRow label="Industry setup" value={`${plan.fields.length} tailored answers saved`} />
              <ReviewRow label="Cover image" value={bannerUrl ? "Uploaded" : "Template image"} />
            </dl>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-semibold">Your store will start with an industry-aware setup.</p><p className="mt-1 text-sm leading-6 text-muted-foreground">BizNest will use these answers in the merchant experience so your dashboard, storefront and next steps make sense for your business type.</p></div></div>
          </div>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between border-t border-border pt-5">
        <button type="button" onClick={goBack} disabled={stepIndex === 0 || isSubmitting} className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-0"><ChevronLeft className="h-4 w-4" /> Back</button>
        {step !== "Review" ? (
          <button type="button" onClick={goNext} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">Continue <ChevronRight className="h-4 w-4" /></button>
        ) : (
          <button type="button" onClick={handlePublish} disabled={isSubmitting || storeName.trim().length < 3} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{isSubmitting ? "Creating your store…" : "Create my store"}
          </button>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-background p-4 shadow-sm"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function FeaturePill({ text }: { text: string }) {
  return <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium"><Check className="h-4 w-4 text-primary" />{text}</div>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 px-5 py-3.5"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>;
}
