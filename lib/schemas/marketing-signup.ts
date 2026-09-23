import { z } from "zod";

/**
 * Shared between the client-side form (components/marketing/marketing-signup-form.tsx,
 * for immediate field validation) and the server action
 * (lib/actions/marketing-signup.ts, for the authoritative check).
 *
 * Deliberately NOT in lib/actions/marketing-signup.ts: that file has a
 * top-level "use server" directive, and Next.js only allows async function
 * exports from a "use server" file. A non-function export like a Zod
 * schema gets silently stripped from the client bundle -- so importing it
 * from a Client Component leaves you with `undefined` at runtime instead
 * of a schema, and calling `.safeParse` on it throws inside the submit
 * handler with no visible error (the button "does nothing" on click).
 */
export const marketingSignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  niche: z.string().min(1, "Choose a niche"),
  phone: z.string().min(4, "Enter a phone number"),
  description: z.string().min(10, "Tell us briefly what the business does").max(1000),
  country: z.string().min(2, "Enter your country"),
  state: z.string().min(2, "Enter your state"),
  city: z.string().min(2, "Enter your city"),
  website: z.string().url("Enter a valid website URL").or(z.literal("")).optional(),
  address: z.string().max(250).optional(),
});
export type MarketingSignupInput = z.infer<typeof marketingSignupSchema>;