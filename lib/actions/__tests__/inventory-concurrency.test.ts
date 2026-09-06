import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

function read(name: string) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

describe("inventory concurrency hardening", () => {
  it("serializes plain inventory adjustments and retries serialization conflicts", () => {
    const source = read("actions/inventory.ts");
    expect(source).toContain('isolationLevel: "Serializable"');
    expect(source).toContain('err?.code === "P2034"');
    expect(source).toContain("StockMovement");
  });

  it("serializes variant inventory adjustments and retries serialization conflicts", () => {
    const source = read("actions/variant.ts");
    expect(source).toContain('isolationLevel: "Serializable"');
    expect(source).toContain('err?.code === "P2034"');
  });

  it("receives purchase-order stock and received counts in one serializable transaction", () => {
    const source = read("actions/purchase-order.ts");
    expect(source).toContain('isolationLevel: "Serializable"');
    expect(source).toContain('quantityReceived: { increment: qty }');
    expect(source).toContain('type: "RESTOCK"');
    expect(source).toContain('err?.code === "P2034"');
  });
});
