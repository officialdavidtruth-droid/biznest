import type { Sticker } from "@/lib/browse";

export const COVER_W = 1080;
export const COVER_H = 1350; // 4:5, the same shape as the feed tile

/** Sticker size is a share of the picture width, matching the editor and the feed (9.4% of width per 1.0 size). */
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/**
 * Loads a video so frames can be read. iPhones and some Android browsers won't load a video that isn't on the page,
 * so it is attached (invisible) and given a time limit instead of waiting forever.
 */
export async function loadVideo(url: string, timeoutMs = 8000): Promise<{ v: HTMLVideoElement; dispose: () => void }> {
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
  Object.assign(v.style, { position: "fixed", left: "0", top: "0", width: "2px", height: "2px", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(v);
  const dispose = () => { v.removeAttribute("src"); v.load(); v.remove(); };
  try {
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error("The video took too long to load.")), timeoutMs);
      v.onloadeddata = () => { clearTimeout(t); res(); };
      v.onerror = () => { clearTimeout(t); rej(new Error("Couldn't read the video.")); };
      v.src = `${url}#t=0.1`;
      v.load();
    });
  } catch (e) { dispose(); throw e; }
  return { v, dispose };
}

function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    const done = () => { clearTimeout(timer); v.removeEventListener("seeked", done); res(); };
    const timer = setTimeout(done, 2500);
    v.addEventListener("seeked", done);
    v.currentTime = Math.max(0, Math.min(t, Math.max(0, (v.duration || t) - 0.05)));
  });
}

/** Length of a video in seconds, or null if the browser can't tell within a few seconds. */
export async function readVideoLength(url: string): Promise<number | null> {
  try {
    const { v, dispose } = await loadVideo(url, 6000);
    const d = Number.isFinite(v.duration) ? v.duration : null;
    dispose();
    return d;
  } catch { return null; }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't prepare the cover image."))), "image/jpeg", 0.9));
}

function drawStickers(ctx: CanvasRenderingContext2D, stickers: Sticker[]) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const st of stickers) {
    const x = (st.x / 100) * COVER_W, y = (st.y / 100) * COVER_H;
    if (st.k === "text") {
      const size = Math.round(st.s * 0.055 * COVER_W);
      ctx.font = `700 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
      const w = ctx.measureText(st.e).width + size * 0.8, h = size * 1.5;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, size * 0.4); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(st.e, x, y);
    } else {
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(st.s * 0.094 * COVER_W)}px ${EMOJI_FONT}`;
      ctx.fillText(st.e, x, y);
    }
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
  const { v, dispose } = await loadVideo(videoUrl);
  try {
    await seekTo(v, time);
    const { canvas, ctx } = newCanvas();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, COVER_W, COVER_H);
    const scale = Math.min(COVER_W / v.videoWidth, COVER_H / v.videoHeight);
    const w = v.videoWidth * scale, h = v.videoHeight * scale;
    ctx.drawImage(v, (COVER_W - w) / 2, (COVER_H - h) / 2, w, h);
    drawStickers(ctx, stickers);
    return new File([await toBlob(canvas)], "cover.jpg", { type: "image/jpeg" });
  } finally { dispose(); }
}

/** Small preview frames spread across a stretch of a video, for the cover picker's filmstrip. */
export async function videoFrames(videoUrl: string, start: number, end: number, count = 8): Promise<string[]> {
  const { v, dispose } = await loadVideo(videoUrl);
  const out: string[] = [];
  try {
    const c = document.createElement("canvas");
    c.width = 72; c.height = 96;
    const ctx = c.getContext("2d");
    if (!ctx) return out;
    const scale = Math.min(72 / v.videoWidth, 96 / v.videoHeight);
    for (let i = 0; i < count; i++) {
      await seekTo(v, start + ((end - start) * i) / Math.max(1, count - 1));
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 72, 96);
      ctx.drawImage(v, (72 - v.videoWidth * scale) / 2, (96 - v.videoHeight * scale) / 2, v.videoWidth * scale, v.videoHeight * scale);
      out.push(c.toDataURL("image/jpeg", 0.6));
    }
  } finally { dispose(); }
  return out;
}
