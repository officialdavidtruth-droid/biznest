import { describe, expect, it } from "vitest";
import { filterNavGroupsForRole } from "../dashboard-nav";
import { STAFF_PERMISSIONS } from "@/lib/access/staff-permissions";

const groups = [{ label: "Apps", items: [{ label: "Installed", href: "/apps", icon: null as never, children: [
  { label: "Financial Control", href: "/apps/financial-control", icon: null as never, permission: "plugin:financial-control" as const },
  { label: "HR", href: "/apps/hr-payroll", icon: null as never, permission: "plugin:hr-payroll" as const },
] }] }];

describe("auditor-only access", () => {
  it("is offered as its own permission", () => {
    expect(STAFF_PERMISSIONS.some((p) => p.id === "finance:audit")).toBe(true);
  });
  it("shows an auditor the Financial Control page and nothing else", () => {
    const out = filterNavGroupsForRole(groups, { canManageOwnerOnly: false, permissions: ["finance:audit"] });
    expect(out[0].items[0].children?.map((c) => c.label)).toEqual(["Financial Control"]);
  });
  it("shows staff with no grant nothing", () => {
    const out = filterNavGroupsForRole(groups, { canManageOwnerOnly: false, permissions: [] });
    expect(out[0].items[0].children).toEqual([]);
  });
});
