import { describe, expect, it } from "vitest";
import { buildNavGroups } from "@/lib/constants/dashboard-nav";

const labels = (b: Parameters<typeof buildNavGroups>[0]) => buildNavGroups(b).flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])]));

describe("Posts in the dashboard sidebar", () => {
  it.each([
    ["Travel & Tourism", { sellsProducts: false, offersServices: true }],
    ["Retail", { sellsProducts: true, offersServices: false }],
    ["Agency", { sellsProducts: false, offersServices: true }],
  ])("shows Posts for %s without installing any app", (category, flags) => {
    const posts = labels({ ...flags, category }).filter((i) => i.href === "/blog");
    expect(posts).toHaveLength(1);
    expect(posts[0].label).toBe("Posts");
  });

  it("does not list Posts a second time under Installed Apps", () => {
    const items = labels({ sellsProducts: false, offersServices: true, category: "Travel & Tourism", installedApps: [{ key: "blog", name: "BizNest Blog" } as never] });
    expect(items.filter((i) => i.href === "/blog")).toHaveLength(1);
  });
});
