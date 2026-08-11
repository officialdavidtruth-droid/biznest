import { afterEach, describe, expect, it } from "vitest";
import { generateUniqueStoreSlug, storeAdminUrl, storePublicUrl } from "../slug";

describe("generateUniqueStoreSlug", () => {
  it("slugifies a simple name with no collisions", async () => {
    const slug = await generateUniqueStoreSlug("Stacey's Paradise", async () => false);
    expect(slug).toBe("staceys-paradise");
  });

  it("appends -2, -3, ... on repeated collisions, in order", async () => {
    const taken = new Set(["staceys-paradise", "staceys-paradise-2", "staceys-paradise-3"]);
    const slug = await generateUniqueStoreSlug("Stacey's Paradise", async (candidate) =>
      taken.has(candidate)
    );
    expect(slug).toBe("staceys-paradise-4");
  });

  it("two people naming the same store both get distinct, valid slugs", async () => {
    // Simulates the exact scenario called out in the README's design notes.
    const claimed = new Set<string>();
    const exists = async (candidate: string) => claimed.has(candidate);

    const first = await generateUniqueStoreSlug("Stacey's Paradise", exists);
    claimed.add(first);
    const second = await generateUniqueStoreSlug("Stacey's Paradise", exists);
    claimed.add(second);

    expect(first).not.toBe(second);
    expect(first).toBe("staceys-paradise");
    expect(second).toBe("staceys-paradise-2");
  });

  it("handles names with special characters and casing", async () => {
    const slug = await generateUniqueStoreSlug("  Café DÉJÀ VU!! ", async () => false);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("storePublicUrl", () => {
  const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
  });

  it("uses a <slug>.biznest.space subdomain in production", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.biznest.space";
    expect(storePublicUrl("velox-space")).toBe("https://velox-space.biznest.space");
  });

  it("falls back to the path-based URL off biznest.space (e.g. Vercel previews, localhost)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://biznest-git-preview.vercel.app";
    expect(storePublicUrl("velox-space")).toBe(
      "https://biznest-git-preview.vercel.app/store/velox-space"
    );
  });
});

describe("storeAdminUrl", () => {
  const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
  });

  it("always stays on the root biznest.space domain, even in production", () => {
    // Unlike storePublicUrl, this must NOT become a slug.biznest.space
    // address — the dashboard is root-domain-only (see middleware.ts).
    process.env.NEXT_PUBLIC_APP_URL = "https://www.biznest.space";
    expect(storeAdminUrl("velox-space")).toBe("https://www.biznest.space/store/velox-space/admin");
  });

  it("uses the path-based URL on Vercel previews and localhost", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://biznest-git-preview.vercel.app";
    expect(storeAdminUrl("velox-space")).toBe(
      "https://biznest-git-preview.vercel.app/store/velox-space/admin"
    );
  });
});
