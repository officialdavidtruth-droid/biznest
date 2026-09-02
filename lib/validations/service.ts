import { z } from "zod";

const DAY_RANGE = z.tuple([z.string().regex(/^\d{2}:\d{2}$/), z.string().regex(/^\d{2}:\d{2}$/)]);

export const serviceSchema = z.object({
  name: z.string().min(2, "Service name is required").max(120),
  categoryId: z.string().cuid().optional().or(z.literal("")),
  description: z.string().min(10, "Add a bit more detail (10+ characters)").max(255, "Keep the short description under 255 characters"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  currency: z.string().default("NGN"),
  images: z.array(z.string().url()).max(8, "Up to 8 images"),
  isPublished: z.boolean().default(true),

  // Booking setup -- see ServiceBookingModeField. "none" = plain, unbookable
  // service; "appointment" = single time-slot against weekly hours;
  // "units" = N identical units (rooms, tables, fleet) booked by date range.
  bookingMode: z.enum(["none", "appointment", "units"]).default("none"),
  durationMins: z.coerce.number().int().min(5).optional(),
  availability: z.record(z.array(DAY_RANGE)).optional(),
  totalUnits: z.coerce.number().int().min(1).optional(),

  // Free-form, niche-specific fields -- same shape/purpose as
  // Product.attributes (see lib/validations/product.ts).
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
