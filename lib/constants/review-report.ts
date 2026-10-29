import type { ReviewReportStatus } from "@prisma/client";

/**
 * Why a merchant can report a review. A low rating, on its own, is never
 * grounds for removal — these are for reviews that break the rules.
 */
export const REVIEW_REPORT_REASONS = [
  { value: "ABUSIVE", label: "Abusive or hateful language" },
  { value: "SPAM", label: "Spam or advertising" },
  { value: "FAKE", label: "Fake — not a real customer" },
  { value: "OFF_TOPIC", label: "Not about this business" },
  { value: "PRIVATE_INFO", label: "Shares private information" },
] as const;

export type ReviewReportReason = (typeof REVIEW_REPORT_REASONS)[number]["value"];

export const REVIEW_REPORT_REASON_LABELS: Record<string, string> = Object.fromEntries(
  REVIEW_REPORT_REASONS.map((r) => [r.value, r.label])
);

export const REVIEW_REPORT_MAX_DETAILS = 1000;

export const REVIEW_REPORT_STATUS_CONFIG: Record<ReviewReportStatus, { label: string; bg: string; text: string; ring: string }> = {
  OPEN: { label: "Reported — awaiting BizNest review", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  UPHELD: { label: "Report upheld — review removed", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  DISMISSED: { label: "Report reviewed — review kept", bg: "bg-gray-100", text: "text-gray-600", ring: "ring-gray-200" },
};
