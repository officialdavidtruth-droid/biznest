import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "@/components/storefront/rich-text";

const render = (text: string) => renderToStaticMarkup(createElement(RichText, { text }));

describe("RichText", () => {
  it("escapes raw HTML instead of injecting it", () => {
    const html = render("<script>alert(1)</script> <img src=x onerror=alert(1)>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
  it("renders the editor's formatting", () => {
    const html = render("**Bold** and _it_ and <u>under</u>\n\n- one\n- two\n\n1. a\n2. b");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em>it</em>");
    expect(html).toContain("<u>under</u>");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<ol><li>a</li><li>b</li></ol>");
  });
});
