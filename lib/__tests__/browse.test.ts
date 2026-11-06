import { describe, expect, it } from "vitest";
import {
  BROWSE_CAPTION_MAX, BROWSE_COMMENT_MAX, BROWSE_MAX_IMAGES, compactCount, containsLink, decodeCursor, defaultProductCaption, encodeCursor,
  isMogulStore, toBio, BIO_MAX, isStoryLive, isViewerKey, orderRings, popularityScore, safeHttpsImage, sanitizeComment, sanitizePost, sanitizeStory, STORY_BG_COLORS, STORY_TEXT_MAX, STORY_TTL_MS, storyExpiry, timeAgo,
} from "@/lib/browse";

describe("links", () => {
  it("spots links and bare domains", () => {
    for (const t of ["see https://x.co", "www.shop.ng", "buy at mystore.com now", "call shop.ng/deal", "visit abc.store"]) expect(containsLink(t)).toBe(true);
    for (const t of ["Lovely dress, how much?", "Is it 3.5 inches?", "Great, thanks Mr. Ade"]) expect(containsLink(t)).toBe(false);
  });
});

describe("sanitizePost", () => {
  it("needs text or a photo and keeps only https images, max four", () => {
    expect(sanitizePost({ caption: "  ", images: [] })).toEqual({ ok: false, error: "Write something or add a photo." });
    const imgs = Array.from({ length: 6 }, (_, i) => `https://img.example.com/${i}.jpg`);
    const r = sanitizePost({ caption: "Hi", images: [...imgs, "http://bad.example.com/x.jpg", "javascript:alert(1)", 5] });
    expect(r.ok && r.images).toHaveLength(BROWSE_MAX_IMAGES);
    expect(sanitizePost({ images: ["http://a.example.com/x.jpg"] }).ok).toBe(false);
  });
  it("trims the caption, keeps line breaks and enforces the limit", () => {
    const r = sanitizePost({ caption: "Line one\r\n\r\n\r\n\r\nLine   two " + "x".repeat(BROWSE_CAPTION_MAX) });
    expect(r.ok && r.caption.startsWith("Line one\n\nLine two")).toBe(true);
    expect(r.ok && r.caption.length).toBe(BROWSE_CAPTION_MAX);
  });
  it("can require an image", () => {
    expect(sanitizePost({ caption: "x" }, { requireImage: true })).toEqual({ ok: false, error: "Add at least one photo." });
  });
  it("rejects credentials in image urls", () => {
    expect(safeHttpsImage("https://user:pw@img.example.com/x.jpg")).toBeNull();
  });
});

describe("sanitizeComment", () => {
  it("accepts a plain comment with a name", () => {
    expect(sanitizeComment({ name: " Ada ", body: "  Love   it  " })).toEqual({ ok: true, name: "Ada", body: "Love it" });
  });
  it("uses the signed-in name over the typed one", () => {
    expect(sanitizeComment({ name: "x", body: "Hi" }, { signedInName: "Tunde" })).toMatchObject({ name: "Tunde" });
  });
  it("rejects empty, long, linked and nameless comments", () => {
    expect(sanitizeComment({ name: "Ada", body: " " }).ok).toBe(false);
    expect(sanitizeComment({ name: "Ada", body: "x".repeat(BROWSE_COMMENT_MAX + 1) }).ok).toBe(false);
    expect(sanitizeComment({ name: "Ada", body: "dm me www.spam.ng" }).ok).toBe(false);
    expect(sanitizeComment({ name: "A", body: "Hi" }).ok).toBe(false);
    expect(sanitizeComment({ name: "buy.com", body: "Hi" }).ok).toBe(false);
  });
});

describe("cursors and viewers", () => {
  it("round-trips a cursor and rejects junk", () => {
    const d = new Date("2026-12-01T10:00:00.000Z");
    expect(decodeCursor(encodeCursor({ createdAt: d, id: "abc" }))).toEqual({ createdAt: d, id: "abc" });
    for (const bad of [null, "", "not-base64!!", Buffer.from("{}").toString("base64url"), Buffer.from(JSON.stringify({ t: "x", id: "a" })).toString("base64url")]) expect(decodeCursor(bad)).toBeNull();
  });
  it("validates viewer keys", () => {
    expect(isViewerKey("u:cm123456789")).toBe(true);
    expect(isViewerKey("d:abcdefghijklmnop")).toBe(true);
    expect(isViewerKey("x:abc")).toBe(false);
    expect(isViewerKey("u:short")).toBe(false);
  });
});

describe("ranking and display", () => {
  const now = new Date("2026-12-10T12:00:00Z");
  const h = (n: number) => new Date(now.getTime() - n * 3_600_000);
  it("prefers engagement but decays with age", () => {
    expect(popularityScore({ likeCount: 20, commentCount: 5, createdAt: h(5) }, now)).toBeGreaterThan(popularityScore({ likeCount: 2, commentCount: 0, createdAt: h(5) }, now));
    expect(popularityScore({ likeCount: 20, commentCount: 5, createdAt: h(300) }, now)).toBeLessThan(popularityScore({ likeCount: 20, commentCount: 5, createdAt: h(5) }, now));
    expect(popularityScore({ likeCount: 1, commentCount: 0, createdAt: h(0.1) }, now)).toBeGreaterThan(popularityScore({ likeCount: 1, commentCount: 0, createdAt: h(48) }, now));
  });
  it("formats time and counts", () => {
    expect(timeAgo(h(0), now)).toBe("just now");
    expect(timeAgo(new Date(now.getTime() - 5 * 60_000), now)).toBe("5m");
    expect(timeAgo(h(3), now)).toBe("3h");
    expect(timeAgo(h(50), now)).toBe("2d");
    expect(timeAgo(h(24 * 15), now)).toBe("2w");
    expect([0, 999, 1000, 1500, 12_000, 2_500_000].map(compactCount)).toEqual(["0", "999", "1k", "1.5k", "12k", "2.5m"]);
  });
  it("makes a default product caption", () => {
    expect(defaultProductCaption("Red Ankara Dress")).toBe("New in the shop: Red Ankara Dress");
  });
});

describe("stories", () => {
  it("needs a photo or text; a photo wins over a text card", () => {
    expect(sanitizeStory({})).toEqual({ ok: false, error: "Add a photo or write some text." });
    expect(sanitizeStory({ imageUrl: "http://x.example.com/a.jpg" }).ok).toBe(false);
    expect(sanitizeStory({ imageUrl: "https://img.example.com/a.jpg", text: "Fresh!" })).toEqual({ ok: true, kind: "IMAGE", imageUrl: "https://img.example.com/a.jpg", text: "Fresh!", bgColor: null });
  });
  it("text cards get a known background and a length limit", () => {
    const r = sanitizeStory({ text: "x".repeat(STORY_TEXT_MAX + 50), bgColor: "#be123c" });
    expect(r.ok && r.kind === "TEXT" && r.bgColor === "#be123c" && r.text?.length === STORY_TEXT_MAX).toBe(true);
    const odd = sanitizeStory({ text: "Hi", bgColor: "red; background:url(x)" });
    expect(odd.ok && odd.bgColor).toBe(STORY_BG_COLORS[0]);
  });
  it("lives for 24 hours", () => {
    const now = new Date("2026-12-01T10:00:00Z");
    const exp = storyExpiry(now);
    expect(exp.getTime() - now.getTime()).toBe(STORY_TTL_MS);
    expect(isStoryLive({ status: "ACTIVE", expiresAt: exp }, new Date(now.getTime() + 3_600_000))).toBe(true);
    expect(isStoryLive({ status: "ACTIVE", expiresAt: exp }, new Date(exp.getTime() + 1))).toBe(false);
    expect(isStoryLive({ status: "HIDDEN", expiresAt: exp }, now)).toBe(false);
  });
  it("orders unseen rings first, newest first within each group", () => {
    const out = orderRings([
      { id: "a", allSeen: true, latestAt: "2026-12-01T09:00:00Z" },
      { id: "b", allSeen: false, latestAt: "2026-12-01T07:00:00Z" },
      { id: "c", allSeen: false, latestAt: "2026-12-01T08:00:00Z" },
      { id: "d", allSeen: true, latestAt: "2026-12-01T09:30:00Z" },
    ]);
    expect(out.map((r) => r.id)).toEqual(["c", "b", "d", "a"]);
  });
});

describe("Mogul badge and bio", () => {
  it("shows the Mogul badge only on an up-to-date Business Mogul plan", () => {
    expect(isMogulStore({ subscription: { name: "Business Mogul" } })).toBe(true);
    expect(isMogulStore({ subscription: { name: " business mogul " } })).toBe(true);
    expect(isMogulStore({ subscription: { name: "Enterprise" } })).toBe(false);
    expect(isMogulStore({ subscription: { name: "Business Mogul" }, subscriptionPastDueSince: new Date() })).toBe(false);
    expect(isMogulStore({ subscription: null })).toBe(false);
    expect(isMogulStore(null)).toBe(false);
  });
  it("tidies the description into a bio and shortens long ones at a word", () => {
    expect(toBio("  We sell  fresh bread.\r\n\n\n\nCome by!  ")).toBe("We sell fresh bread.\n\nCome by!");
    expect(toBio(undefined)).toBe("");
    const long = "word ".repeat(300);
    const out = toBio(long);
    expect(out.length).toBeLessThanOrEqual(BIO_MAX + 1);
    expect(out.endsWith("…")).toBe(true);
    expect(out.endsWith(" …")).toBe(false);
  });
});
