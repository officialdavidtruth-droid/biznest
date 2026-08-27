// Helpers shared by hotel storefront pages: currency formatting and
// detecting whether a stored bannerUrl is actually a video (mp4/webm or a
// YouTube/Vimeo link) so the hero can render as an autoplay video instead of
// a static background image, without requiring a schema change.

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export type HeroMedia =
  | { type: "none" }
  | { type: "image"; url: string }
  | { type: "file-video"; url: string }
  | { type: "youtube"; embedUrl: string }
  | { type: "vimeo"; embedUrl: string };

const YOUTUBE_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/i;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/i;
const FILE_VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;

export function resolveHeroMedia(url: string | null | undefined): HeroMedia {
  if (!url) return { type: "none" };

  const yt = url.match(YOUTUBE_RE);
  if (yt) {
    const id = yt[1];
    return {
      type: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&rel=0&playsinline=1`,
    };
  }

  const vimeo = url.match(VIMEO_RE);
  if (vimeo) {
    const id = vimeo[1];
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1`,
    };
  }

  if (FILE_VIDEO_RE.test(url)) {
    return { type: "file-video", url };
  }

  return { type: "image", url };
}
