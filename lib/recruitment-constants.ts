export const RECRUIT_STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const;
export type RecruitStageId = (typeof RECRUIT_STAGES)[number];
export const PIPELINE_STAGES: RecruitStageId[] = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"];
export const JOB_STATUSES = ["DRAFT", "OPEN", "ON_HOLD", "FILLED", "CLOSED"] as const;
export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP"] as const;
