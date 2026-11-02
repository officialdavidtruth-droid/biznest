import { describe, expect, it } from "vitest";
import { PLUGIN_CATALOG } from "@/lib/plugins";
import { getBusinessTypeConfig } from "@/lib/capabilities";
import { PIPELINE_STAGES, RECRUIT_STAGES } from "@/lib/recruitment-constants";

describe("Recruitment (applicant tracking) plugin", () => {
  it("is in the catalog for HR & Recruitment only", () => {
    const p = PLUGIN_CATALOG.find((x) => x.key === "recruitment-ats");
    expect(p).toBeDefined();
    expect(p?.eligibleBusinessTypes).toEqual(["HR & Recruitment"]);
  });
  it("is reachable from the HR & Recruitment quick actions", () => {
    const c = getBusinessTypeConfig("HR & Recruitment");
    expect(c.quickActions.some((a) => a.href === "/apps/recruitment-ats")).toBe(true);
  });
  it("board stages are a subset of all stages", () => {
    for (const s of PIPELINE_STAGES) expect(RECRUIT_STAGES).toContain(s);
  });
});
