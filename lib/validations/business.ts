import { z } from "zod";
import { isValidCountry } from "@/lib/geo";
import { getSubcategoryConfig, isValidSubcategory } from "@/lib/business-subcategories";
import { isComingSoonBusinessType } from "@/lib/business-type-status";

export const guarantorSchema = z.object({
  fullName: z.string().min(2, "Enter the guarantor's full name"),
  phone: z.string().min(7, "Enter the guarantor's phone number"),
  email: z.string().email("Enter a valid email address"),
  governmentIdUrl: z.string().url("Upload the guarantor's government ID"),
  relationship: z.string().min(2, "Say how you know them (e.g. friend, family)"),
});

// Base fields shared by both registration paths. Kept as a plain object
// (no .refine() here) so it can still be .extend()-ed below; the
// "at least one of sellsProducts/offersServices" check is applied to the
// combined union afterwards, since ZodEffects from .refine() can't be
// extended.
const businessBaseSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  category: z.string().min(1, "Select a category"),
  businessSubcategory: z.string().max(120).optional(),
  description: z.string().min(20, "Please provide a fuller description (20+ characters)"),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().email(),
  country: z.string().min(1, "Select a country").refine((c) => isValidCountry(c), "Choose a country from the list"),
  state: z.string().min(1, "Select a state"),
  city: z.string().min(1, "Enter your city"),
  // What the business sells. At least one must be true — a store can be
  // a pure product seller, a pure service provider, or hybrid (both).
  // This drives which dashboard sections and storefront layout show up.
  sellsProducts: z.boolean().default(false),
  offersServices: z.boolean().default(false),
});

// Discriminated union so the two verification paths are validated correctly:
// REGISTERED requires a certificate; UNREGISTERED requires ID + selfie + exactly 2 guarantors.
export const businessVerificationSchema = z
  .discriminatedUnion("registrationType", [
    businessBaseSchema.extend({
      registrationType: z.literal("REGISTERED"),
      registrationCertUrl: z.string().url("Upload your business registration certificate"),
    }),
    businessBaseSchema.extend({
      registrationType: z.literal("UNREGISTERED"),
      governmentIdUrl: z.string().url("Upload a valid government-issued ID"),
      selfieUrl: z.string().url("Selfie verification is required"),
      guarantors: z
        .array(guarantorSchema)
        .length(2, "Exactly two guarantors are required"),
    }),
  ])
  .superRefine((data, ctx) => {
    if (!data.sellsProducts && !data.offersServices) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one: you sell products, offer services, or both",
        path: ["sellsProducts"],
      });
    }
    if (isComingSoonBusinessType(data.category)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${data.category} businesses are coming soon. Pick another category for now.`, path: ["category"] });
    }
    // Categories with a specialty list (see lib/business-subcategories.ts)
    // must pick one of its options; the stored value is the option name.
    const config = getSubcategoryConfig(data.category);
    if (config && !isValidSubcategory(data.category, data.businessSubcategory)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: data.businessSubcategory ? "Choose a specialty from the list" : "Choose your specialty",
        path: ["businessSubcategory"],
      });
    }
  });

export type BusinessVerificationInput = z.infer<typeof businessVerificationSchema>;

export const fraudPolicyAcceptanceSchema = z.object({
  businessId: z.string().cuid(),
  accepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the policy to continue" }),
  }),
});

export const createStoreSchema = z.object({
  businessId: z.string().cuid(),
  storeName: z
    .string()
    .min(3, "Store name must be at least 3 characters")
    .max(60, "Store name must be under 60 characters"),
  templateId: z.string().cuid().optional(),
  // Collected in the branding step of the onboarding wizard. Both optional —
  // a vendor can skip and add these later from the dashboard. When set,
  // logoUrl/bannerUrl override the auto-fetched demo banner in createStore.
  logoUrl: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  // Industry-specific setup answers collected before the store is published.
  // Kept intentionally flexible so new business types can add fields without
  // another database migration.
  onboardingProfile: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
    .optional(),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
