import { z } from "zod";

// Fee column is Decimal(12,2): max 9,999,999,999.99. Cap far lower — no real
// delivery fee is near it, and it keeps absurd/typo values out.
export const MAX_DELIVERY_FEE = 10_000_000;

const trimmed = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer.`);

/**
 * Shared by create and update so both enforce the same rules. A missing or
 * blank fee is an error (never silently 0 — that would make delivery free).
 */
export const deliveryZoneSchema = z.object({
  city: trimmed(80).transform((v) => v.replace(/\s+/g, " ") || null),
  name: trimmed(120).min(1, "Zone name is required."),
  fee: z
    .string({ required_error: "Fee is required." })
    .trim()
    .min(1, "Fee is required.")
    .transform((v) => Number(v))
    .pipe(
      z
        .number({ invalid_type_error: "Fee must be a number." })
        .finite("Fee must be a number.")
        .min(0, "Fee must be zero or more.")
        .max(MAX_DELIVERY_FEE, "Fee is too large.")
    )
    // Column is Decimal(12,2): round here so the saved value is what was validated.
    .transform((n) => Math.round(n * 100) / 100),
  estimatedMinutes: z
    .string()
    .trim()
    .nullable()
    .transform((v) => (v ? Number(v) : null))
    .pipe(
      z
        .number({ invalid_type_error: "ETA must be a number." })
        .int("ETA must be a whole number of minutes.")
        .min(0, "ETA can't be negative.")
        .max(10_080, "ETA can't exceed 7 days.")
        .nullable()
    ),
});

export type DeliveryZoneInput = z.infer<typeof deliveryZoneSchema>;

export function parseDeliveryZoneForm(formData: FormData) {
  const parsed = deliveryZoneSchema.safeParse({
    city: String(formData.get("city") ?? ""),
    name: String(formData.get("name") ?? ""),
    fee: formData.get("fee") == null ? undefined : String(formData.get("fee")),
    estimatedMinutes: formData.get("estimatedMinutes") == null ? null : String(formData.get("estimatedMinutes")),
  });
  if (parsed.success) return { success: true as const, data: parsed.data };
  return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };
}
