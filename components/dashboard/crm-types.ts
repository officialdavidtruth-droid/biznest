export type LeadActivity = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  createdAt: Date | string;
};

export type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  status: string;
  value: number | null;
  currency: string;
  notes: string | null;
  lastContactedAt?: Date | string | null;
  nextFollowUpAt: Date | string | null;
  createdAt?: Date | string;
  activities: LeadActivity[];
};

// Class names are written out in full so Tailwind can see them.
export const STAGES = [
  { id: "NEW", label: "New", hint: "Just came in", dot: "bg-slate-400", bar: "border-t-slate-400", chip: "bg-slate-500/10 text-slate-600 ring-slate-500/20", active: "bg-slate-600 text-white border-slate-600" },
  { id: "CONTACTED", label: "Contacted", hint: "You've reached out", dot: "bg-sky-500", bar: "border-t-sky-500", chip: "bg-sky-500/10 text-sky-700 ring-sky-500/20", active: "bg-sky-600 text-white border-sky-600" },
  { id: "QUALIFIED", label: "Qualified", hint: "A real opportunity", dot: "bg-violet-500", bar: "border-t-violet-500", chip: "bg-violet-500/10 text-violet-700 ring-violet-500/20", active: "bg-violet-600 text-white border-violet-600" },
  { id: "PROPOSAL", label: "Proposal", hint: "Quote or offer sent", dot: "bg-amber-500", bar: "border-t-amber-500", chip: "bg-amber-500/10 text-amber-700 ring-amber-500/20", active: "bg-amber-500 text-white border-amber-500" },
  { id: "WON", label: "Won", hint: "Deal closed", dot: "bg-emerald-500", bar: "border-t-emerald-500", chip: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20", active: "bg-emerald-600 text-white border-emerald-600" },
  { id: "LOST", label: "Lost", hint: "Didn't go ahead", dot: "bg-rose-500", bar: "border-t-rose-500", chip: "bg-rose-500/10 text-rose-700 ring-rose-500/20", active: "bg-rose-600 text-white border-rose-600" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];
export const stageOf = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0];
export const isClosed = (status: string) => status === "WON" || status === "LOST";
export const nextStage = (status: string) => {
  const i = STAGES.findIndex((s) => s.id === status);
  return i >= 0 && i < 3 ? STAGES[i + 1] : null; // New → … → Proposal → Won handled by the drawer
};

export const SOURCES = [
  { id: "MANUAL", label: "Added by hand" },
  { id: "WEBSITE", label: "Website" },
  { id: "FORM", label: "Form" },
  { id: "WHATSAPP", label: "WhatsApp" },
  { id: "EMAIL", label: "Email" },
  { id: "PHONE", label: "Phone" },
  { id: "BOOKING", label: "Booking" },
  { id: "ORDER", label: "Order" },
  { id: "REFERRAL", label: "Referral" },
  { id: "SOCIAL", label: "Social media" },
  { id: "OTHER", label: "Other" },
] as const;
export const sourceLabel = (id: string) => SOURCES.find((s) => s.id === id)?.label ?? id;

export const money = (n: number | string | null | undefined) => `₦${Number(n ?? 0).toLocaleString("en-NG")}`;
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
export const shortDate = (d: Date | string) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

/** Where a lead's next follow-up sits relative to today (null `now` = not mounted yet). */
export function followUpState(lead: Pick<Lead, "status" | "nextFollowUpAt">, now: number | null): "none" | "overdue" | "today" | "upcoming" {
  if (!lead.nextFollowUpAt || isClosed(lead.status) || now === null) return "none";
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const t = new Date(lead.nextFollowUpAt).getTime();
  if (t < start.getTime()) return "overdue";
  if (t < start.getTime() + 86_400_000) return "today";
  return "upcoming";
}
