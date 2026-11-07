import { describe, expect, it } from "vitest";
import { buildNavGroups } from "@/lib/constants/dashboard-nav";

const all = (category: string, flags: { sellsProducts: boolean; offersServices: boolean }) =>
  buildNavGroups({ ...flags, category }).flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])]));

describe("Browse in the dashboard sidebar", () => {
  it.each([
    ["Retail", { sellsProducts: true, offersServices: false }],
    ["Agency", { sellsProducts: false, offersServices: true }],
  ])("is a group with posts, activity, insights and ads for %s", (category, flags) => {
    const items = all(category, flags);
    const browse = buildNavGroups({ ...flags, category }).flatMap((g) => g.items).find((i) => i.label === "Browse");
    expect(browse?.href).toBe("/browse");
    expect(browse?.children?.map((c) => c.href)).toEqual(["/browse/posts", "/browse/activity", "/browse/insights", "/ads"]);
    // Ads appears once, inside the Browse group.
    expect(items.filter((i) => i.href === "/ads")).toHaveLength(1);
  });
});
