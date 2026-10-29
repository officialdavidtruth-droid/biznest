import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("refund inventory automation", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib/inventory-refund.ts"), "utf8");

  it("captures auto-unpublished state before clearing it so refunds can republish correctly", () => {
    expect(source).toContain("const wasAutoUnpublished = inventory.autoUnpublished;");
    expect(source).toContain("if (quantityBefore <= 0 && wasAutoUnpublished)");
  });

  it("does not use the cleared autoUnpublished flag for the republish decision", () => {
    expect(source).not.toContain("inventory.autoUnpublished) {");
  });
});
