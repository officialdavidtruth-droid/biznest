import { describe, expect, it } from "vitest";
import { builderConfigSaveSchema, defaultBuilderConfig } from "@/lib/builder-config";

describe("owner-written stats and testimonials", () => {
  it("are accepted as items on those sections", () => {
    const c = defaultBuilderConfig("Acme");
    const stats = c.sections.find((s) => s.type === "stats")!;
    const testimonials = c.sections.find((s) => s.type === "testimonials")!;
    stats.settings.items = [{ title: "500+", body: "Happy customers" }];
    testimonials.settings.items = [{ title: "Ada O.", body: "Arrived the next day." }];
    expect(builderConfigSaveSchema.safeParse(c).success).toBe(true);
  });
});
