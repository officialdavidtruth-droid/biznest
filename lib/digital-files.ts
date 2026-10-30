import { v2 as cloudinary } from "cloudinary";

/**
 * Digital product files are stored as Cloudinary "authenticated" raw assets,
 * so the stored URL is never publicly fetchable. Product.digitalFileUrl holds
 * a private reference (PRIVATE_PREFIX + public_id) instead of a delivery URL;
 * the download route checks the buyer's paid order and streams the file.
 * Legacy values that are plain https URLs keep working (they are still public
 * -- re-upload those files to protect them).
 */
export const PRIVATE_PREFIX = "private-asset://";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function makePrivateRef(publicId: string): string {
  return `${PRIVATE_PREFIX}${publicId}`;
}

export function parsePrivateRef(value: string | null | undefined): string | null {
  return value && value.startsWith(PRIVATE_PREFIX) ? value.slice(PRIVATE_PREFIX.length) : null;
}

/** Server-side-only signed delivery URL for a private raw asset. Never send this to the browser. */
export function signedPrivateUrl(publicId: string): string {
  return cloudinary.url(publicId, { resource_type: "raw", type: "authenticated", sign_url: true, secure: true });
}

/** Digital goods accepted by the digital upload purpose. */
export const DIGITAL_ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/epub+zip",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "video/mp4",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
]);
export const DIGITAL_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Signed direct-to-Cloudinary upload for digital files. The browser uploads
 * straight to Cloudinary (so Vercel's ~4.5MB request-body limit doesn't apply)
 * using a short-lived signature minted here for one authenticated user.
 * The folder is fixed per user, and the signature covers every parameter, so
 * the client cannot change where the file lands or make it public.
 */
export function signDigitalUpload(userId: string) {
  const params: Record<string, string | number> = {
    folder: `biznest/${userId}/digital`,
    type: "authenticated",
    use_filename: "true",
    unique_filename: "true",
    timestamp: Math.round(Date.now() / 1000),
  };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET ?? "");
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    params,
    signature,
  };
}
