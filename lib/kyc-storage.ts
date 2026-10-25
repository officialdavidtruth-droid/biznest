import { v2 as cloudinary } from "cloudinary";

/**
 * Private storage for KYC documents (government IDs, selfies, registration
 * certificates, guarantor IDs).
 *
 * These are uploaded to Cloudinary with type "authenticated", so the plain
 * delivery URL we store in the DB does NOT work in a browser -- Cloudinary
 * refuses anything without a signature. The only way to read a document is
 * through /api/admin/kyc-doc, which checks the admin session, looks the URL
 * up from the DB (never from the request) and fetches it server-side with a
 * short-lived signed download link.
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const KYC_FOLDER_ROOT = "biznest-kyc";

export function kycFolderFor(userId: string) {
  return `${KYC_FOLDER_ROOT}/${userId}`;
}

const AUTH_URL_RE =
  /^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/authenticated\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+)$/;

export type ParsedKycUrl = { resourceType: "image" | "video" | "raw"; publicId: string; format: string };

/** Parses a stored private-KYC URL. Returns null for anything that isn't one. */
export function parseKycUrl(url: string): ParsedKycUrl | null {
  const m = AUTH_URL_RE.exec(url.split("?")[0]);
  if (!m) return null;
  const resourceType = m[1] as ParsedKycUrl["resourceType"];
  const path = decodeURIComponent(m[2]);
  if (resourceType === "raw") return { resourceType, publicId: path, format: "" };
  const dot = path.lastIndexOf(".");
  if (dot === -1) return { resourceType, publicId: path, format: "" };
  return { resourceType, publicId: path.slice(0, dot), format: path.slice(dot + 1) };
}

/** True only for a private KYC asset that lives in this user's own folder. */
export function isOwnKycUrl(url: string, userId: string): boolean {
  const parsed = parseKycUrl(url);
  return Boolean(parsed && parsed.publicId.startsWith(`${kycFolderFor(userId)}/`));
}

/** Short-lived (2 min) signed Cloudinary download URL for a private KYC asset. */
export function signedKycDownloadUrl(parsed: ParsedKycUrl): string {
  return cloudinary.utils.private_download_url(parsed.publicId, parsed.format, {
    resource_type: parsed.resourceType,
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 120,
  });
}
