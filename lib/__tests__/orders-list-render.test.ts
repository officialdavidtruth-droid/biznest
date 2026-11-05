import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrdersList, type OrderCardData } from "@/components/storefront/orders-list";

const order = (over: Partial<OrderCardData> = {}): OrderCardData => ({
  id: "ck1", shortId: "60RQNYW6", status: "PAID", currency: "NGN", totalLabel: "NGN 100", placedLabel: "Today", placedTitle: "5 November 2026",
  trackingUrl: null, deliveryLabel: null, riderName: null, hasDispute: false, canDispute: true,
  items: [{ name: "Lol", image: null, qty: 1, href: "/store/s/product/p1" }], ...over,
});
const html = (orders: OrderCardData[]) => renderToStaticMarkup(createElement(OrdersList, { slug: "s", orders, accent: "#4f46e5", accentInk: "#4338ca", storeName: "Velox", orderWord: "orders" }));

describe("OrdersList", () => {
  it("lifts in-progress orders into their own section above past orders", () => {
    const out = html([order(), order({ id: "ck2", status: "DELIVERED", canDispute: true })]);
    expect(out.indexOf("In progress")).toBeLessThan(out.indexOf("Past orders"));
    expect(out).toContain("Order progress"); // stepper only for the active one
    expect(out.match(/aria-label="Order progress"/g)).toHaveLength(1);
  });
  it("shows filter chips with counts and hides empty groups", () => {
    const out = html([order(), order({ id: "ck2", status: "DELIVERED" })]);
    expect(out).toContain("In progress");
    expect(out).toContain("Delivered");
    expect(out).not.toContain(">Closed");
  });
  it("offers buy again only once an order is no longer in progress, and a quiet report link", () => {
    const out = html([order({ id: "a" }), order({ id: "b", status: "DELIVERED" })]);
    expect(out.match(/Buy again/g)).toHaveLength(1);
    expect(out.match(/Report a problem/g)).toHaveLength(2);
  });
  it("renders delivery tracking only for safe http(s) links and the dispute link when one exists", () => {
    const out = html([order({ id: "a", status: "IN_PROGRESS", trackingUrl: "https://track.example/1", riderName: "Musa", deliveryLabel: "On the way" }), order({ id: "b", hasDispute: true, status: "DISPUTED" })]);
    expect(out).toContain("Track delivery · Musa");
    expect(out).toContain("Delivery: On the way");
    expect(out).toContain("View dispute");
    expect(out).not.toContain("Buy again");
  });
  it("marks the current progress step for assistive tech", () => {
    const out = html([order({ status: "IN_PROGRESS" })]);
    expect(out).toContain('aria-current="step"');
    expect(out).toContain("(done)");
    expect(out).toContain("(current step)");
  });
  it("shows the item count and a +N more headline for multi-item orders", () => {
    const items = ["A", "B", "C", "D", "E"].map((n) => ({ name: n, image: null, qty: 1, href: "/x" }));
    const out = html([order({ items })]);
    expect(out).toContain("A + 4 more");
    expect(out).toContain("+2");
  });
});
