import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { RotatingWord } from "@/components/motion/rotating-word";
import { NestGraphic } from "@/components/motion/nest-graphic";

// The server HTML must already contain the final content: motion only decorates it.
describe("landing motion components render real content on the server", () => {
  it("Reveal leaves its children visible (not hidden) before scripts run", () => {
    const html = renderToString(h(Reveal, { delay: 120 }, h("p", null, "Verified sellers")));
    expect(html).toContain("Verified sellers");
    expect(html).not.toContain("bn-reveal-armed");
  });
  it("CountUp shows the final number, with a readable label", () => {
    const html = renderToString(h(CountUp, { value: "1,250+" }));
    expect(html).toContain("1,250+");
    expect(html).toContain('aria-label="1,250+"');
  });
  it("CountUp passes through text with no number", () => {
    expect(renderToString(h(CountUp, { value: "Live" }))).toContain("Live");
  });
  it("RotatingWord renders every word, only the first marked as shown", () => {
    const html = renderToString(h(RotatingWord, { words: ["fashion", "hotels", "salons"] }));
    for (const w of ["fashion", "hotels", "salons"]) expect(html).toContain(w);
    expect(html).toContain('data-state="on"');
  });
  it("NestGraphic is decorative", () => {
    const html = renderToString(h(NestGraphic));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("bn-nest-ring");
  });
});
