import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Vitest compiles TSX with the classic JSX transform (Next uses the automatic one), so components need a global React.
(globalThis as { React?: typeof React }).React = React;

vi.mock("@prisma/client", () => ({ PrismaClient: class { $on() {} }, Prisma: {} }));
vi.mock("@/components/storefront/store-menu", () => ({ MenuLinks: () => null }));
vi.mock("@/components/storefront/cart-link", () => ({ CartLink: () => null }));
vi.mock("@/components/storefront/builder-newsletter-form", () => ({ BuilderNewsletterForm: () => null }));
vi.mock("@/components/storefront/contact-enquiry-form", () => ({ ContactEnquiryForm: () => createElement("form", { id: "enquiry-form" }) }));
vi.mock("next/link", () => ({ default: (p: { href: string; children?: unknown }) => createElement("a", { href: p.href }, p.children as never) }));

import { BuilderSubpage, type SubpageKind } from "@/components/storefront/builder-subpages";
import { defaultBuilderConfig } from "@/lib/builder-config";

const store = {
  name: "Acme", slug: "acme", logoUrl: null, contactEmail: "hi@acme.test", contactPhone: "+234 800 000 0000",
  business: { description: "Default business description", category: "Fashion", sellsProducts: true, offersServices: false },
};
const data = { storyImage: null, location: "Abuja", itemCount: 3, completedOrders: 0, avgRating: null, reviews: [], categories: [] };

function render(kind: SubpageKind, owner?: { title: string; body: string } | null) {
  return renderToStaticMarkup(createElement(BuilderSubpage, { kind, store, design: defaultBuilderConfig("Acme").design, data, owner }));
}

describe("About / Contact / Gallery / Blog show what the owner wrote", () => {
  it("about: owner text replaces the default description; without it the default stays", () => {
    const own = render("about", { title: "Our story", body: "Founded in a garage in 2014." });
    // The footer always shows the business description; what must change is the page body.
    expect(own).toContain('pre-line">Founded in a garage in 2014.</p>');
    expect(own).not.toContain('pre-line">Default business description</p>');
    expect(own).toContain("<h1");
    expect(render("about")).toContain('pre-line">Default business description</p>');
  });

  it("contact: owner note shows above the form and the form is still there", () => {
    const html = render("contact", { title: "Find us", body: "Open Mon-Sat, 9am to 6pm." });
    expect(html).toContain("Open Mon-Sat, 9am to 6pm.");
    expect(html).toContain('id="enquiry-form"');
    expect(html).toContain("tel:+234 800 000 0000");
  });

  it("gallery: renders the owner's photos with captions and ignores unsafe lines", () => {
    const html = render("gallery", { title: "Gallery", body: "Take a look\nhttps://cdn.test/a.jpg | Our shop\njavascript:alert(1)" });
    expect(html).toContain("a.jpg");
    expect(html).toContain("Our shop");
    expect(html).toContain("Take a look");
    expect(html).not.toMatch(/url\([^)]*javascript/);
  });

  it("blog: renders each post with its title and text", () => {
    const html = render("blog", { title: "News", body: "Big sale\nEverything half price.\n---\nNew store\nWe moved." });
    expect(html).toContain("Big sale");
    expect(html).toContain("Everything half price.");
    expect(html).toContain("New store");
    expect(html).toContain("We moved.");
  });
});
