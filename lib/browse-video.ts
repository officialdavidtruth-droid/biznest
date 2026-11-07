/** Pure helpers for Browse video posts. No server imports, so they run in tests and in the browser. */

/** Vendors can post videos up to this long. Only the BizNest super admin has no limit. */
export const BROWSE_VIDEO_MAX_SECONDS = 60;
/** Cloudinary's free plan refuses single files above 100 MB. */
export const BROWSE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const BROWSE_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"] as const;

/**
 * Applied by Cloudinary as the file arrives; the original is discarded, so storage stays small.
 * 720p max, H.264, automatic quality. Vendors also get the first 60 seconds only (du_60), which
 * is how the limit is enforced even if someone skips the app's own check.
 */
export function incomingTransformation(unlimited: boolean): string {
  const base = "c_limit,h_720,w_1280,q_auto,vc_h264";
  return unlimited ? base : `${base},du_${BROWSE_VIDEO_MAX_SECONDS}`;
}

/** Folder a video must live in. Vendor videos are tied to their store; the official account has its own. */
export const videoFolder = (storeId: string, official: boolean) => (official ? "biznest/browse/official" : `biznest/browse/${storeId}`);

const MARKER = "/video/upload/";

/** True only for a public Cloudinary video inside the expected folder. */
export function isBrowseVideoUrl(raw: unknown, folder: string): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && u.hostname === "res.cloudinary.com" && !u.username && !u.password
      && u.pathname.includes(MARKER) && u.pathname.includes(`/${folder}/`);
  } catch { return false; }
}

/** The URL to play: mp4/H.264 with automatic quality. Non-Cloudinary URLs are returned unchanged. */
export function playableVideoUrl(url: string): string {
  return url.includes(MARKER) ? url.replace(MARKER, `${MARKER}f_mp4,vc_h264,q_auto/`) : url;
}

/** A still frame from the first second, sized for the 4:5 feed tile. Also used as images[0] for link previews. */
export function videoPosterUrl(url: string): string {
  if (!url.includes(MARKER)) return url;
  return url.replace(MARKER, `${MARKER}so_0,c_fill,g_auto,w_720,h_900,q_auto,f_jpg/`).replace(/\.[a-z0-9]+(\?.*)?$/i, ".jpg");
}

export function videoErrorFor(file: { type: string; size: number }, seconds: number | null, unlimited: boolean): string | null {
  if (!(BROWSE_VIDEO_TYPES as readonly string[]).includes(file.type)) return "Use an MP4, MOV or WebM video.";
  if (file.size > BROWSE_VIDEO_MAX_BYTES) return `That video is ${Math.round(file.size / 1048576)} MB. The limit is ${BROWSE_VIDEO_MAX_BYTES / 1048576} MB.`;
  if (!unlimited && seconds != null && seconds > BROWSE_VIDEO_MAX_SECONDS) return `Videos can be up to ${BROWSE_VIDEO_MAX_SECONDS} seconds. This one is ${Math.ceil(seconds)} seconds.`;
  return null;
}
