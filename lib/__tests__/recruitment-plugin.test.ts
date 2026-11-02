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

import { toHrEmploymentType, nextEmployeeNo } from "@/lib/recruitment-constants";

describe("Hired → HR & Payroll employee", () => {
  it("maps job employment types onto HR's", () => {
    expect(toHrEmploymentType("INTERNSHIP")).toBe("INTERN");
    expect(toHrEmploymentType("CONTRACT")).toBe("CONTRACT");
    expect(toHrEmploymentType("PART_TIME")).toBe("PART_TIME");
    expect(toHrEmploymentType("nonsense")).toBe("FULL_TIME");
    expect(toHrEmploymentType(null)).toBe("FULL_TIME");
  });
  it("generates the next sequential employee number", () => {
    expect(nextEmployeeNo([])).toBe("EMP-001");
    expect(nextEmployeeNo(["EMP-001", "EMP-009", "A-12"])).toBe("EMP-010");
    expect(nextEmployeeNo(["emp-099"])).toBe("EMP-100");
  });
});
