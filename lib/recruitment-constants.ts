export const RECRUIT_STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const;
export type RecruitStageId = (typeof RECRUIT_STAGES)[number];
export const PIPELINE_STAGES: RecruitStageId[] = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"];
export const JOB_STATUSES = ["DRAFT", "OPEN", "ON_HOLD", "FILLED", "CLOSED"] as const;
export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP"] as const;

/** Recruitment job types → HR employment types (HR calls internships "INTERN"). */
export function toHrEmploymentType(t: string | null | undefined): "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | "TEMPORARY" {
  if (t === "INTERNSHIP") return "INTERN";
  return (["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY"] as const).find((x) => x === t) ?? "FULL_TIME";
}

/** Next sequential employee number (EMP-001, EMP-002 …) given the numbers already in use. */
export function nextEmployeeNo(existing: string[]): string {
  let max = 0;
  for (const n of existing) {
    const m = /^EMP-(\d+)$/i.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `EMP-${String(max + 1).padStart(3, "0")}`;
}
