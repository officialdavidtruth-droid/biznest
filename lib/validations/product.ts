import { z } from "zod";

const MAX_PRICE = 999_999_999; // column is Decimal(12,2)
const MAX_QUANTITY = 1_000_000; // far below the Int column limit
const MAX_ATTRIBUTES_BYTES = 200_000; // holds the rich-text long description

function isValidCurrency(code: string): boolean {
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
  }
}

export const productSchema = z.object({
  name: z.string().min(2, "Product name is required").max(120),
  categoryId: z.string().cuid().optional().or(z.literal("")),
  type: z.enum(["PHYSICAL", "DIGITAL", "RENTAL"]),
  description: z.string().min(10, "Add a bit more detail (10+ characters)").max(255, "Keep the short description under 255 characters"),
  price: z.coerce.number().positive("Price must be greater than 0").max(MAX_PRICE, "Price is too large"),
  compareAtPrice: z.coerce.number().positive().max(MAX_PRICE, "Price is too large").optional().or(z.literal("")),
  currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code, e.g. NGN")
    .transform((c) => c.toUpperCase())
    .refine(isValidCurrency, "Unknown currency code")
    .default("NGN"),
  // http(s) only: blocks javascript:/data: and other schemes.
  images: z.array(z.string().url().regex(/^https?:\/\//i, "Image links must start with http(s)://")).max(8, "Up to 8 images"),
  isPublished: z.boolean().default(true),
  quantity: z.coerce.number().int().min(0).max(MAX_QUANTITY, "Quantity is too large").default(0),
  sku: z.string().max(64).optional().or(z.literal("")),
  barcode: z.string().max(64).optional().or(z.literal("")),
  // Either a private reference made by the digital upload flow (biznest/<user>/digital/<file>)
  // or a legacy http(s) link. Nothing else.
  digitalFileUrl: z
    .string()
    .refine(
      (v) => !v.includes("..") && !v.includes("\\") && (/^private-asset:\/\/biznest\/[^/]+\/digital\/[^/].*$/.test(v) || /^https:\/\/\S+$/i.test(v)),
      "Invalid file reference"
    )
    .optional()
    .or(z.literal("")),
  rentalPeriodUnit: z.enum(["day", "week", "month"]).optional(),
  // Free-form, niche-specific fields (tags, featured/taxable/special-request
  // toggles, and any custom key/value pairs the merchant adds) stored on
  // Product.attributes. Kept as a loose record here rather than named
  // columns so this form -- and this schema -- stay usable for every niche
  // without a migration per vertical.
  attributes: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
    .refine((a) => JSON.stringify(a).length <= MAX_ATTRIBUTES_BYTES, "Extra details are too large")
    .optional(),
}).superRefine((d, ctx) => {
  // A paid digital product without a file would take payment and then 404 on download.
  if (d.type === "DIGITAL" && !d.digitalFileUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["digitalFileUrl"], message: "Upload the file buyers will receive" });
  }
  if (d.type === "RENTAL" && !d.rentalPeriodUnit) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rentalPeriodUnit"], message: "Choose a rental period (day, week or month)" });
  }
  if (typeof d.compareAtPrice === "number" && d.compareAtPrice <= d.price) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["compareAtPrice"], message: "Compare-at price must be higher than the price" });
  }
});

export type ProductInput = z.infer<typeof productSchema>;
