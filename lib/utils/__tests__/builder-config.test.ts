import { describe, expect, it } from "vitest";
import { defaultBuilderConfig, readBuilderConfig } from "@/lib/builder-config";

describe("visual website builder config", () => {
  it("creates a valid production-safe default configuration", () => {
    const config = defaultBuilderConfig("Acme", "Quality products");
    expect(readBuilderConfig(config)?.version).toBe(1);
    expect(config.sections[0].type).toBe("hero");
  });

  it("rejects malformed section configuration", () => {
    expect(readBuilderConfig({ version: 1, design: {}, sections: [] })).toBeNull();
  });

  it("preserves section ordering and visibility", () => {
    const config = defaultBuilderConfig("Acme");
    config.sections.reverse();
    config.sections[0].visible = false;
    const parsed = readBuilderConfig(config);
    expect(parsed?.sections[0].visible).toBe(false);
    expect(parsed?.sections[0].id).toBe(config.sections[0].id);
  });
});
