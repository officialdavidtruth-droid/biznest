"use client";

import { useForm, Controller, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { businessVerificationSchema, type BusinessVerificationInput } from "@/lib/validations/business";
import { submitBusinessVerification } from "@/lib/actions/business";
import { FileUploadField } from "@/components/forms/file-upload-field";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ALL_BUSINESS_TYPE_NAMES, getBusinessTypeConfig } from "@/lib/capabilities";
import { PROFESSIONAL_SERVICE_SUBNICHES } from "@/lib/professional-services";
import { AlertTriangle, Check, Package, CalendarClock, FileText, type LucideIcon } from "lucide-react";

// Sourced from lib/capabilities.ts — this used to be a separate
// hand-maintained list that only covered 10 of the categories the
// marketing homepage advertised, so picking "Real Estate" or "Photography"
// or "Hotel & Lodging" here wasn't actually possible even though the
// homepage said it was. Single source of truth now.
const CATEGORIES = [...ALL_BUSINESS_TYPE_NAMES, "Other"];

export function BusinessVerificationForm({
  existingRejection,
}: {
  existingRejection?: string | null;
}) {
  const router = useRouter();
  const [registrationType, setRegistrationType] = useState<"REGISTERED" | "UNREGISTERED">("REGISTERED");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState("");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BusinessVerificationInput>({
    resolver: zodResolver(businessVerificationSchema),
    defaultValues: {
      registrationType: "REGISTERED",
      sellsProducts: true,
      offersServices: false,
      guarantors: [
        { fullName: "", phone: "", email: "", governmentIdUrl: "", relationship: "" },
        { fullName: "", phone: "", email: "", governmentIdUrl: "", relationship: "" },
      ],
    } as Partial<BusinessVerificationInput>,
  });

  async function onSubmit(values: BusinessVerificationInput) {
    setIsSubmitting(true);
    const result = await submitBusinessVerification(values);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Verification submitted. We'll review it shortly.");
    router.push("/onboarding/business-verification");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bv-form">
      {existingRejection && (
        <div className="mb-8 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p className="leading-relaxed">
            <span className="font-semibold">Your previous submission was rejected: </span>
            {existingRejection}
            <span className="block text-amber-700">Review the details below and resubmit when you're ready.</span>
          </p>
        </div>
      )}

      <div className="divide-y divide-border">
        <Section n={1} title="Business details" description="The basics buyers and BizNest need to know about your business.">
          <Field label="Business name" error={errors.businessName?.message}>
            <input className="bv-input" {...register("businessName")} />
          </Field>

          <Field label="Category" error={errors.category?.message}>
            <select
              className="bv-input"
              {...register("category")}
              onChange={(e) => { setCategory(e.target.value); register("category").onChange(e); }}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          {category === "Professional Services" && (
            <Field label="Professional services specialty" error={errors.businessSubcategory?.message}>
              <select className="bv-input" {...register("businessSubcategory")}>
                <option value="">Choose your specialty</option>
                {PROFESSIONAL_SERVICE_SUBNICHES.map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">This controls the storefront, dashboard workflow and recommended tools BizNest gives you.</p>
            </Field>
          )}

          <Field label="Description" error={errors.description?.message}>
            <textarea className="bv-input min-h-24 resize-y" {...register("description")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" error={errors.phone?.message}>
              <input className="bv-input" {...register("phone")} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input className="bv-input" type="email" {...register("email")} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Country" error={errors.country?.message}>
              <input className="bv-input" {...register("country")} />
            </Field>
            <Field label="State" error={errors.state?.message}>
              <input className="bv-input" {...register("state")} />
            </Field>
            <Field label="City" error={errors.city?.message}>
              <input className="bv-input" {...register("city")} />
            </Field>
          </div>
        </Section>

        <Section n={2} title="What does your business do?" description="This decides what shows up in your dashboard and on your storefront — pick both if you do both.">
          <div className="grid gap-3 sm:grid-cols-2">
            <OptionCard
              icon={Package}
              title="I sell products"
              description="Physical goods, digital downloads, or rentals — buyers add to cart and check out."
              inputProps={register("sellsProducts")}
            />
            <OptionCard
              icon={CalendarClock}
              title="I offer services"
              description="Appointments or bookings — buyers pick a time slot instead of a shipping address."
              inputProps={register("offersServices")}
            />
          </div>
          {(errors as Record<string, { message?: string }>).sellsProducts?.message && (
            <p className="mt-3 text-xs text-destructive">
              {(errors as Record<string, { message?: string }>).sellsProducts?.message}
            </p>
          )}
        </Section>

        <Section n={3} title="Verification path" description="Choose whichever matches your situation — both are fully valid ways to verify.">
          <div className="mb-5 inline-flex rounded-full border border-border bg-muted p-1 text-sm">
            {(["REGISTERED", "UNREGISTERED"] as const).map((type) => {
              const active = registrationType === type;
              return (
                <label
                  key={type}
                  className={`cursor-pointer rounded-full px-4 py-1.5 font-medium transition-colors ${
                    active ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    value={type}
                    checked={active}
                    {...register("registrationType")}
                    onChange={() => setRegistrationType(type)}
                    className="sr-only"
                  />
                  {type === "REGISTERED" ? "Registered business" : "Not registered yet"}
                </label>
              );
            })}
          </div>

          {registrationType === "REGISTERED" ? (
            <UploadFrame>
              <Controller
                name="registrationCertUrl"
                control={control}
                render={({ field }) => (
                  <FileUploadField
                    label="Business registration certificate"
                    value={field.value as string}
                    onChange={field.onChange}
                    error={(errors as Record<string, { message?: string }>).registrationCertUrl?.message}
                  />
                )}
              />
            </UploadFrame>
          ) : (
            <div className="space-y-4">
              <UploadFrame>
                <Controller
                  name="governmentIdUrl"
                  control={control}
                  render={({ field }) => (
                    <FileUploadField
                      label="Government-issued ID"
                      value={field.value as string}
                      onChange={field.onChange}
                      error={(errors as Record<string, { message?: string }>).governmentIdUrl?.message}
                    />
                  )}
                />
              </UploadFrame>
              <UploadFrame>
                <Controller
                  name="selfieUrl"
                  control={control}
                  render={({ field }) => (
                    <FileUploadField
                      label="Selfie verification"
                      value={field.value as string}
                      onChange={field.onChange}
                      error={(errors as Record<string, { message?: string }>).selfieUrl?.message}
                    />
                  )}
                />
              </UploadFrame>

              <div className="pt-2">
                <p className="mb-3 text-sm font-medium text-foreground">Guarantors <span className="font-normal text-muted-foreground">(2 required)</span></p>
                <div className="space-y-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded-xl border border-border bg-muted/50 p-4">
                      <div className="mb-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                        {i + 1}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input className="bv-input" placeholder="Full name" {...register(`guarantors.${i}.fullName` as const)} />
                        <input className="bv-input" placeholder="Phone" {...register(`guarantors.${i}.phone` as const)} />
                        <input className="bv-input" placeholder="Email" {...register(`guarantors.${i}.email` as const)} />
                        <input className="bv-input" placeholder="Relationship" {...register(`guarantors.${i}.relationship` as const)} />
                      </div>
                      <div className="mt-3">
                        <Controller
                          name={`guarantors.${i}.governmentIdUrl` as const}
                          control={control}
                          render={({ field }) => (
                            <UploadFrame>
                              <FileUploadField label="Guarantor government ID" value={field.value as string} onChange={field.onChange} />
                            </UploadFrame>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-8 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {isSubmitting ? "Submitting…" : "Submit for review"}
      </button>

      <style jsx global>{`
        .bv-input {
          width: 100%;
          border-radius: 0.625rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.6rem 0.8rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .bv-input:focus {
          outline: none;
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
        .bv-input::placeholder {
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </form>
  );
}

function Section({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-7 first:pt-0 last:pb-0">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/25 text-[11px] font-bold text-primary">
          {n}
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="space-y-4 pl-9">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function OptionCard({
  icon: Icon,
  title,
  description,
  inputProps,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  inputProps: UseFormRegisterReturn;
}) {
  return (
    <label className="group relative flex cursor-pointer gap-3 rounded-xl border border-border p-4 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/[0.04]">
      <input type="checkbox" className="peer sr-only" {...inputProps} />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground peer-checked:bg-primary peer-checked:text-primary-foreground">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span>
        <span className="mb-0.5 block font-medium text-foreground">{title}</span>
        <span className="block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <Check className="absolute right-3 top-3 hidden h-4 w-4 text-primary peer-checked:block" strokeWidth={3} />
    </label>
  );
}

function UploadFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/60 p-4">
      <FileText className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
