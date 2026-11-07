import { describe, expect, it } from "vitest";
import { sanitizePost } from "@/lib/browse";
import { BROWSE_VIDEO_MAX_BYTES, incomingTransformation, isBrowseVideoUrl, playableVideoUrl, videoErrorFor, videoFolder, videoPosterUrl } from "@/lib/browse-video";

const url = "https://res.cloudinary.com/democloud/video/upload/v1700000000/biznest/browse/store_abc/clip1.mp4";

describe("browse video", () => {
  it("trims vendor uploads to 60 seconds but not the official account", () => {
    expect(incomingTransformation(false)).toContain("du_60");
    expect(incomingTransformation(true)).not.toContain("du_");
    expect(incomingTransformation(true)).toContain("h_720");
  });
  it("only accepts videos from the right folder", () => {
    expect(isBrowseVideoUrl(url, videoFolder("store_abc", false))).toBe(true);
    expect(isBrowseVideoUrl(url, videoFolder("store_other", false))).toBe(false);
    expect(isBrowseVideoUrl(url, videoFolder("x", true))).toBe(false);
    expect(isBrowseVideoUrl("http://res.cloudinary.com/democloud/video/upload/biznest/browse/store_abc/a.mp4", "biznest/browse/store_abc")).toBe(false);
    expect(isBrowseVideoUrl("https://evil.example/video/upload/biznest/browse/store_abc/a.mp4", "biznest/browse/store_abc")).toBe(false);
    expect(isBrowseVideoUrl("https://res.cloudinary.com/democloud/image/upload/biznest/browse/store_abc/a.jpg", "biznest/browse/store_abc")).toBe(false);
  });
  it("builds playable and poster urls", () => {
    expect(playableVideoUrl(url)).toContain("/video/upload/f_mp4,vc_h264,q_auto/v1700000000");
    const poster = videoPosterUrl(url);
    expect(poster).toContain("so_0");
    expect(poster.endsWith("clip1.jpg")).toBe(true);
  });
  it("checks files before upload", () => {
    const ok = { type: "video/mp4", size: 5 * 1024 * 1024 };
    expect(videoErrorFor(ok, 45, false)).toBeNull();
    expect(videoErrorFor(ok, 61, false)).toMatch(/60 seconds/);
    expect(videoErrorFor(ok, 600, true)).toBeNull();
    expect(videoErrorFor({ type: "image/png", size: 10 }, 5, false)).toMatch(/MP4/);
    expect(videoErrorFor({ type: "video/mp4", size: BROWSE_VIDEO_MAX_BYTES + 1 }, 5, true)).toMatch(/limit/);
  });
  it("lets a post be video only", () => {
    const r = sanitizePost({ caption: "", images: [], videoUrl: url });
    expect(r.ok && r.videoUrl).toBe(url);
    expect(sanitizePost({ caption: "", images: [] }).ok).toBe(false);
  });
});

import { adjustTrim } from "@/lib/browse-video";
import { extractHashtags, sanitizeStickers, splitHashtags } from "@/lib/browse";

describe("composer helpers", () => {
  it("trims by start and length", () => {
    expect(incomingTransformation(false, { start: 12, end: 52 })).toMatch(/so_12,du_40$/);
    expect(incomingTransformation(false, { start: 0, end: 200 })).toContain("du_60");
    expect(incomingTransformation(true, { start: 10, end: 400 })).toMatch(/so_10,du_390$/);
    expect(incomingTransformation(true, null)).not.toContain("du_");
  });
  it("keeps vendor clips to 60 seconds when moving handles", () => {
    expect(adjustTrim({ start: 0, end: 60 }, "end", 100, 120, false)).toEqual({ start: 40, end: 100 });
    expect(adjustTrim({ start: 40, end: 100 }, "start", 10, 120, false)).toEqual({ start: 10, end: 70 });
    expect(adjustTrim({ start: 0, end: 60 }, "end", 100, 120, true)).toEqual({ start: 0, end: 100 });
    expect(adjustTrim({ start: 5, end: 10 }, "start", 50, 120, true).start).toBeLessThanOrEqual(9.5);
  });
  it("picks a cover frame", () => {
    expect(videoPosterUrl(url, 3.26)).toContain("so_3.3,");
  });
  it("cleans stickers", () => {
    const r = sanitizeStickers([{ e: "🔥", x: 150, y: -5, s: 9 }, { e: "<script>", x: 1, y: 1, s: 1 }, { e: "", x: 1, y: 1, s: 1 }, "x"]);
    expect(r).toEqual([{ e: "🔥", x: 100, y: 0, s: 4 }]);
    expect(sanitizeStickers(Array.from({ length: 20 }, () => ({ e: "🎉", x: 1, y: 1, s: 1 }))).length).toBe(8);
    expect(sanitizeStickers(null)).toEqual([]);
  });
  it("finds hashtags", () => {
    expect(extractHashtags("New #Shoes in #lagos #shoes")).toEqual(["shoes", "lagos"]);
    expect(splitHashtags("Hi #Promo now").map((p) => p.tag)).toEqual([false, true, false]);
  });
});

import { sanitizeLocation, sanitizeTags, shortPersonName } from "@/lib/browse";

describe("text items and tags", () => {
  it("keeps short text items and rejects links", () => {
    const r = sanitizeStickers([{ e: "  50% off today  ", x: 10, y: 20, s: 1.5, k: "text" }, { e: "visit shop.com", x: 1, y: 1, s: 1, k: "text" }, { e: "<b>hi</b>", x: 1, y: 1, s: 1, k: "text" }]);
    expect(r[0]).toEqual({ e: "50% off today", x: 10, y: 20, s: 1.5, k: "text" });
    expect(r.length).toBe(2);
    expect(r[1].e).toBe("bhi/b");
  });
  it("shortens customer names", () => {
    expect(shortPersonName("Ada Obi")).toBe("Ada O.");
    expect(shortPersonName("Ngozi")).toBe("Ngozi");
    expect(shortPersonName(null)).toBe("A customer");
  });
  it("cleans tag lists and locations", () => {
    const t = sanitizeTags([{ kind: "store", id: "abcdefgh12" }, { kind: "store", id: "abcdefgh12" }, { kind: "user", id: "short" }, { kind: "x", id: "abcdefgh12" }, "no"]);
    expect(t).toEqual([{ kind: "store", id: "abcdefgh12" }]);
    expect(sanitizeTags(Array.from({ length: 30 }, (_, i) => ({ kind: "user", id: `user_id_${i}_abc` }))).length).toBe(10);
    expect(sanitizeLocation("  Lekki   Phase 1 ")).toBe("Lekki Phase 1");
    expect(sanitizeLocation("see www.spam.com")).toBeNull();
  });
});
