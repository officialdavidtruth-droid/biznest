import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Vitest compiles TSX with the classic JSX transform (Next uses the automatic one), so components need a global React.
(globalThis as { React?: typeof React }).React = React;

vi.mock("@prisma/client", () => ({ PrismaClient: class { $on() {} }, Prisma: {} }));
vi.mock("@/components/storefront/store-menu", () => ({ MenuLinks: () => null, useFooterMenu: () => null, useStoreMenu: () => null }));
vi.mock("@/components/storefront/cart-link", () => ({ CartLink: () => null }));
vi.mock("@/components/storefront/builder-newsletter-form", () => ({ BuilderNewsletterForm: () => null }));
vi.mock("next/link", () => ({ default: (p: { href: string; children?: unknown }) => createElement("a", { href: p.href }, p.children as never) }));

import { BuilderStorefront } from "@/components/storefront/builder-renderer";
import { defaultBuilderConfig, type BuilderConfig, type BuilderSection } from "@/lib/builder-config";

const store = {
  name: "Acme", slug: "acme", logoUrl: null, contactEmail: "hi@acme.test", contactPhone: null,
  business: { description: "We sell things", category: "Fashion", sellsProducts: true, offersServices: false, city: "Abuja", state: "FCT", country: "Nigeria" },
};

function render(sections: BuilderSection[], fallbackFaq?: { title: string; body?: string }[], catalogImage: string | null = "https://cdn.test/product.jpg") {
  const config: BuilderConfig = { ...defaultBuilderConfig("Acme"), sections };
  return renderToStaticMarkup(createElement(BuilderStorefront, {
    store, config, reviews: [], avgRating: null, completedOrders: 0, fallbackFaq,
    catalogItems: [{ id: "p1", kind: "product", name: "Shoe", price: 10, currency: "NGN", image: catalogImage, categoryName: null }],
  }));
}
const sec = (type: BuilderSection["type"], settings: BuilderSection["settings"] = {}): BuilderSection => ({ id: `${type}-1`, type, visible: true, settings });

describe("builder sections show real, editable content", () => {
  it("features: shows the owner's items, and real starter text (never the old filler) when there are none", () => {
    const own = render([sec("features", { items: [{ title: "Free repairs", body: "For a year" }] })]);
    expect(own).toContain("Free repairs");
    expect(own).toContain("For a year");
    expect(own).not.toContain("Quality you can trust");
    // Visitors never see invented text: an empty Features section stays hidden (the editor seeds
    // starter wording instead, see defaultFeatureItems).
    const starter = render([sec("features")]);
    expect(starter).not.toContain("Quality you can trust");
    expect(starter).not.toContain("configured by the business");
  });

  it("faq: owner items beat the store's own FAQ, and there is no invented fallback", () => {
    const fallback = [{ title: "Do you ship abroad?", body: "Yes." }];
    expect(render([sec("faq", { items: [{ title: "Own question", body: "Own answer" }] })], fallback)).toContain("Own question");
    const viaStore = render([sec("faq")], fallback);
    expect(viaStore).toContain("Do you ship abroad?");
    expect(viaStore).not.toContain("How do I place an order?");
    expect(render([sec("faq")])).not.toContain("How do I place an order?");
  });

  it("gallery: uses the owner's uploads, else falls back to catalogue photos", () => {
    const own = render([sec("gallery", { images: ["https://cdn.test/own-1.jpg", "/uploads/own-2.png"] })]);
    expect(own).toContain("own-1.jpg");
    expect(own).toContain("own-2.png");
    expect(own).not.toContain("product.jpg");
    expect(render([sec("gallery")])).toContain("product.jpg");
  });

  it("map: embeds a real map from the address, falls back to the business location, and tells the owner when there is none", () => {
    const own = render([sec("map", { address: "Plot 5 Wuse 2" })]);
    expect(own).toContain("https://www.google.com/maps?q=Plot%205%20Wuse%202&amp;output=embed");
    expect(own).toContain("Get directions");
    expect(render([sec("map")])).toContain("q=Abuja%2C%20FCT%2C%20Nigeria");
    const noLocation = renderToStaticMarkup(createElement(BuilderStorefront, {
      store: { ...store, business: { ...store.business, city: "", state: "", country: "" } },
      config: { ...defaultBuilderConfig("Acme"), sections: [sec("map")] }, reviews: [], avgRating: null, completedOrders: 0, catalogItems: [],
    }));
    expect(noLocation).not.toContain("<iframe");
    expect(noLocation).not.toContain("Add an address"); // that hint is for the owner in the editor, not visitors
  });
});
