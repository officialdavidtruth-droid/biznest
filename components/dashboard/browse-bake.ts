import type { Sticker } from "@/lib/browse";

export const COVER_W = 1080;
export const COVER_H = 1350; // 4:5, the same shape as the feed tile

/** Sticker size is a share of the picture width, matching the editor and the feed (9.4% of width per 1.0 size). */
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't prepare the cover image."))), "image/jpeg", 0.9));
}

function drawStickers(ctx: CanvasRenderingContext2D, stickers: Sticker[]) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const st of stickers) {
    ctx.font = `${Math.round(st.s * 0.094 * COVER_W)}px ${EMOJI_FONT}`;
    ctx.fillText(st.e, (st.x / 100) * COVER_W, (st.y / 100) * COVER_H);
  }
}

function newCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = COVER_W; canvas.height = COVER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't prepare the cover image.");
  return { canvas, ctx };
}

/** A photo cropped to the 4:5 feed tile with the stickers burned in, so link previews show them too. */
export async function bakePhotoCover(file: File, stickers: Sticker[]): Promise<File> {
  const bmp = await createImageBitmap(file);
  const { canvas, ctx } = newCanvas();
  const scale = Math.max(COVER_W / bmp.width, COVER_H / bmp.height);
  const w = bmp.width * scale, h = bmp.height * scale;
  ctx.drawImage(bmp, (COVER_W - w) / 2, (COVER_H - h) / 2, w, h);
  bmp.close?.();
  drawStickers(ctx, stickers);
  return new File([await toBlob(canvas)], "cover.jpg", { type: "image/jpeg" });
}

/** One frame of a video (shown whole on black, like the player does) with the stickers burned in. */
export async function bakeVideoCover(videoUrl: string, time: number, stickers: Sticker[]): Promise<File> {
  const v = document.createElement("video");
  v.muted = true; v.preload = "auto"; v.playsInline = true; v.src = videoUrl;
  await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error("Couldn't read the video.")); });
  await new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = time; });
  const { canvas, ctx } = newCanvas();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  const scale = Math.min(COVER_W / v.videoWidth, COVER_H / v.videoHeight);
  const w = v.videoWidth * scale, h = v.videoHeight * scale;
  ctx.drawImage(v, (COVER_W - w) / 2, (COVER_H - h) / 2, w, h);
  drawStickers(ctx, stickers);
  return new File([await toBlob(canvas)], "cover.jpg", { type: "image/jpeg" });
}
