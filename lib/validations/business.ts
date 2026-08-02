import { z } from "zod";

export const guarantorSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email(),
  governmentIdUrl: z.string().url("Government ID upload is required"),
  relationship: z.string().min(2),
});

// Base fields shared by both registration paths.
const businessBaseSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  category: z.string().min(1, "Select a category"),
  description: z.string().min(20, "Please provide a fuller description (20+ characters)"),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().email(),
  country: z.string().min(1),
  state: z.string().min(1),
  city: z.string().min(1),
});

// Discriminated union so the two verification paths are validated correctly:
// REGISTERED requires a certificate; UNREGISTERED requires ID + selfie + exactly 2 guarantors.
export const businessVerificationSchema = z.discriminatedUnion("registrationType", [
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
]);

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
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
