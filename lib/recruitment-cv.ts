/**
 * CV storage rules for Recruitment. Client-safe (no Cloudinary import) so forms, actions and
 * routes share one definition.
 *
 * Uploaded CVs are private: stored as Cloudinary "authenticated" raw assets in a per-store
 * folder and referenced as `private-asset://<public_id>`. They are only readable through
 * /api/store/[slug]/recruitment/cv, which checks staff permission first. A plain https link
 * (the original behaviour) is still accepted.
 */
export const CV_ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
// Vercel rejects request bodies over ~4.5MB, so stay under it.
export const CV_MAX_BYTES = 4 * 1024 * 1024;
export const CV_ACCEPT = ".pdf,.doc,.docx";
export const CV_TYPE_HINT = "PDF, DOC or DOCX, up to 4MB";

const REF_PREFIX = "private-asset://";

export const cvFolderFor = (storeId: string) => `biznest/${storeId}/recruitment-cvs`;

export const makeCvRef = (publicId: string) => `${REF_PREFIX}${publicId}`;

/** The Cloudinary public_id inside a stored CV ref, or null if it isn't one. */
export function parseCvRef(value: string | null | undefined): string | null {
  return value && value.startsWith(REF_PREFIX) ? value.slice(REF_PREFIX.length) : null;
}

/** True only for a private CV ref that lives in THIS store's CV folder. */
export function isStoreCvRef(value: string, storeId: string): boolean {
  const id = parseCvRef(value);
  return Boolean(id && id.startsWith(`${cvFolderFor(storeId)}/`) && !id.includes(".."));
}

/** Accepts an https link or this store's own private ref; returns an error message otherwise. */
export function validateCvValue(value: string, storeId: string): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return null;
  if (isStoreCvRef(value, storeId)) return null;
  return "The CV must be an uploaded file or a link starting with http:// or https://.";
}

/** Where staff open a candidate's CV from. */
export const cvViewHref = (slug: string, candidateId: string) => `/api/store/${slug}/recruitment/cv?candidateId=${encodeURIComponent(candidateId)}`;
