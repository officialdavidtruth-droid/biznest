import type { DisputeStatus } from "@prisma/client";

export const DISPUTE_STATUS_CONFIG: Record<DisputeStatus, { label: string; bg: string; text: string; ring: string }> = {
  OPEN: { label: "Open", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  UNDER_REVIEW: { label: "Under review", bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  RESOLVED_BUYER: { label: "Resolved — buyer", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  RESOLVED_SELLER: { label: "Resolved — seller", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  CLOSED: { label: "Closed", bg: "bg-gray-100", text: "text-gray-600", ring: "ring-gray-200" },
};

export const DISPUTE_DECISION_OPTIONS: { value: DisputeStatus; label: string; hint: string }[] = [
  { value: "RESOLVED_BUYER", label: "Rule for buyer", hint: "Order moves to REFUNDED — issue the actual refund from Payments afterward." },
  { value: "RESOLVED_SELLER", label: "Rule for seller", hint: "Order moves back to COMPLETED — no refund is issued." },
  { value: "CLOSED", label: "Close — no fault found", hint: "Order moves back to COMPLETED with no action taken." },
];
