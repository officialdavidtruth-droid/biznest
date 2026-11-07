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
