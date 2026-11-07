import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/store/demo/admin", "/x")).toBe("/store/demo/admin");
    expect(safeRedirectPath("/browse?tab=1", "/x")).toBe("/browse?tab=1");
  });
  it("rejects other sites and script URLs", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil.example", "/ok\nSet-Cookie:x", "", null, undefined]) {
      expect(safeRedirectPath(bad as string, "/x")).toBe("/x");
    }
  });
});
