/**
 * Rules for files attached to trips and visa cases. Client-safe (no Cloudinary import) so the form, the routes and
 * the tests share one definition. Files are private: stored as Cloudinary "authenticated" raw assets in a per-store
 * folder and only readable through /api/store/[slug]/travel/attachments/[id] after a staff permission check.
 */
export const ATTACHMENT_KINDS = ["PASSPORT", "TICKET", "VISA", "INSURANCE", "VOUCHER", "OTHER"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];
export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = {
  PASSPORT: "Passport / ID", TICKET: "Ticket", VISA: "Visa approval", INSURANCE: "Insurance", VOUCHER: "Hotel / tour voucher", OTHER: "Other",
};

export const ATTACHMENT_ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
// Vercel rejects request bodies over ~4.5MB, so stay under it.
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
export const ATTACHMENT_TYPE_HINT = "PDF, JPG, PNG or WebP, up to 4MB";
export const MAX_ATTACHMENTS_PER_PARENT = 40;

export const travelFolderFor = (storeId: string) => `biznest/${storeId}/travel-files`;

/** True only for a Cloudinary public_id inside THIS store's travel folder. */
export function isStoreTravelFile(publicId: string, storeId: string): boolean {
  return publicId.startsWith(`${travelFolderFor(storeId)}/`) && !publicId.includes("..");
}

/** Detects the real type from the first bytes, so a renamed .exe or HTML file cannot pass as a PDF or image. */
export function sniffFileType(b: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null {
  const at = (i: number) => b[i];
  if (b.length >= 5 && at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46 && at(4) === 0x2d) return "application/pdf";
  if (b.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (b.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) return "image/png";
  if (b.length >= 12 && at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return "image/webp";
  return null;
}

/** Display name kept from the upload, stripped of path pieces and control characters. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const s = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
  return s || "file";
}

export const attachmentHref = (slug: string, id: string) => `/api/store/${slug}/travel/attachments/${encodeURIComponent(id)}`;
export const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
