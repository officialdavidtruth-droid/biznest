"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { businessVerificationSchema, type BusinessVerificationInput } from "@/lib/validations/business";
import { submitBusinessVerification } from "@/lib/actions/business";
import { FileUploadField } from "@/components/forms/file-upload-field";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ALL_BUSINESS_TYPE_NAMES } from "@/lib/capabilities";

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {existingRejection && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Your previous submission was rejected: {existingRejection}. Please review and resubmit below.
        </div>
      )}

      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Business details</legend>

        <Field label="Business name" error={errors.businessName?.message}>
          <input className="input" {...register("businessName")} />
        </Field>

        <Field label="Category" error={errors.category?.message}>
          <select className="input" {...register("category")}>
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="Description" error={errors.description?.message}>
          <textarea className="input min-h-24" {...register("description")} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone" error={errors.phone?.message}>
            <input className="input" {...register("phone")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input className="input" type="email" {...register("email")} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Country" error={errors.country?.message}>
            <input className="input" {...register("country")} />
          </Field>
          <Field label="State" error={errors.state?.message}>
            <input className="input" {...register("state")} />
          </Field>
          <Field label="City" error={errors.city?.message}>
            <input className="input" {...register("city")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">What does your business do?</legend>
        <p className="text-xs text-muted-foreground">
          This decides what shows up in your dashboard and on your storefront — pick both if you
          do both. You can't continue without selecting at least one.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="checkbox" className="mt-0.5" {...register("sellsProducts")} />
            <span>
              <span className="block font-medium">I sell products</span>
              <span className="block text-xs text-muted-foreground">
                Physical goods, digital downloads, or rentals — buyers add to cart and check out.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="checkbox" className="mt-0.5" {...register("offersServices")} />
            <span>
              <span className="block font-medium">I offer services</span>
              <span className="block text-xs text-muted-foreground">
                Appointments or bookings — buyers pick a time slot instead of a shipping address.
              </span>
            </span>
          </label>
        </div>
        {(errors as Record<string, { message?: string }>).sellsProducts?.message && (
          <p className="text-xs text-destructive">
            {(errors as Record<string, { message?: string }>).sellsProducts?.message}
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Verification path</legend>
        <div className="flex gap-4">
          {(["REGISTERED", "UNREGISTERED"] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                value={type}
                checked={registrationType === type}
                {...register("registrationType")}
                onChange={() => setRegistrationType(type)}
              />
              {type === "REGISTERED" ? "I have a registered business" : "I don't have a registered business"}
            </label>
          ))}
        </div>

        {registrationType === "REGISTERED" ? (
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
        ) : (
          <>
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

            <div className="space-y-4">
              <p className="text-sm font-medium">Guarantors (2 required)</p>
              {[0, 1].map((i) => (
                <div key={i} className="grid grid-cols-2 gap-3 rounded-md border p-3">
                  <input className="input" placeholder="Full name" {...register(`guarantors.${i}.fullName` as const)} />
                  <input className="input" placeholder="Phone" {...register(`guarantors.${i}.phone` as const)} />
                  <input className="input" placeholder="Email" {...register(`guarantors.${i}.email` as const)} />
                  <input className="input" placeholder="Relationship" {...register(`guarantors.${i}.relationship` as const)} />
                  <Controller
                    name={`guarantors.${i}.governmentIdUrl` as const}
                    control={control}
                    render={({ field }) => (
                      <div className="col-span-2">
                        <FileUploadField label="Guarantor government ID" value={field.value as string} onChange={field.onChange} />
                      </div>
                    )}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isSubmitting ? "Submitting…" : "Submit for review"}
      </button>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </form>
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
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
